import { recognize } from '../../services/ai'
import { createItem } from '../../services/items'
import { isApiError } from '../../services/request'
import { uploadImage } from '../../services/upload'
import type { RecognizeResult } from '../../types/api'
import type { IAppOption } from '../../app'
import { checkName, checkTag } from '../../utils/validate'
import { joinPath } from '../../utils/space-path'

function getMimeTypeFromPath(filePath: string, fallback?: string): string {
  if (/\.png$/i.test(filePath)) return 'image/png'
  if (/\.webp$/i.test(filePath)) return 'image/webp'
  if (/\.jpe?g$/i.test(filePath)) return 'image/jpeg'
  const fb = (fallback || '').toLowerCase()
  if (fb === 'png') return 'image/png'
  if (fb === 'webp') return 'image/webp'
  if (fb === 'jpg' || fb === 'jpeg') return 'image/jpeg'
  return 'image/jpeg'
}

function readFileBase64(filePath: string, mime: string): Promise<string> {
  return new Promise<string>(function (resolve, reject) {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success(res: any) {
        resolve('data:' + mime + ';base64,' + res.data)
      },
      fail() {
        reject({ statusCode: 0, message: '图片读取失败' })
      }
    })
  })
}

function compressOnce(
  src: string,
  quality: number,
  compressedWidth?: number,
  compressedHeight?: number
): Promise<string> {
  return new Promise<string>(function (resolve) {
    const opts: any = { src, quality }
    if (compressedWidth) opts.compressedWidth = compressedWidth
    if (compressedHeight) opts.compressedHeight = compressedHeight
    wx.compressImage({
      ...opts,
      success(r: any) {
        resolve(r.tempFilePath || src)
      },
      fail() {
        resolve(src)
      }
    })
  })
}

function calcTargetSize(origW: number, origH: number, maxEdge: number) {
  if (origW <= 0 || origH <= 0) return { width: undefined, height: undefined }
  if (origW <= maxEdge && origH <= maxEdge) return { width: origW, height: origH }
  if (origW >= origH) {
    return {
      width: maxEdge,
      height: Math.max(1, Math.round((origH * maxEdge) / origW))
    }
  }
  return {
    width: Math.max(1, Math.round((origW * maxEdge) / origH)),
    height: maxEdge
  }
}

/**
 * 读临时文件转 dataURL：
 * 1. 依据输出文件的真实后缀与原图类型动态确定 MIME（jpeg/png/webp 等），不盲目硬编码；
 * 2. 分辨率等比缩放至长边 ≤1200px 并进行画质压缩（符合 PRD 800~1200px 规格）。
 * 早期版本曾为适配后端 100KB body 限制做过 720px 二次降级，后端上调限制后已移除。
 */
function toDataUrl(path: string): Promise<string> {
  return new Promise<string>(function (resolve, reject) {
    wx.getImageInfo({
      src: path,
      success(info: any) {
        const origW = info.width || 0
        const origH = info.height || 0
        const { width: targetW, height: targetH } = calcTargetSize(origW, origH, 1200)

        compressOnce(path, 65, targetW, targetH)
          .then(function (compressedPath) {
            const mime = getMimeTypeFromPath(compressedPath, compressedPath === path ? info.type : 'jpg')
            return readFileBase64(compressedPath, mime)
          })
          .then(resolve)
          .catch(reject)
      },
      fail() {
        // getImageInfo 失败时的兜底：按基础质量压缩一次
        compressOnce(path, 60)
          .then(function (p) {
            const mime = getMimeTypeFromPath(p)
            return readFileBase64(p, mime)
          })
          .then(resolve)
          .catch(reject)
      }
    })
  })
}

Page({
  data: {
    img: '',
    /** 手动添加模式：无照片且不触发 AI，照片区显示"从相册选择"占位（onLoad 判定一次，跨页返回不翻转） */
    manual: false,
    score: 0,
    recognizing: false,
    aiFailed: false,
    aiNote: '',
    draft: {
      name: '',
      brand: '',
      model: '',
      category: '',
      color: '',
      desc: '',
      tags: [] as string[]
    },
    locText: '未选择位置',
    aiResultId: '',
    saving: false
  },

  onLoad() {
    // 相机/相册识别流程进入时必带照片且 recognizePending=true；两者皆空即手动添加
    const app = getApp<IAppOption>()
    const gd = app && app.globalData
    if (gd && !gd.recognizeImg && !gd.recognizeImgFull && !gd.recognizePending) {
      this.setData({ manual: true })
    }
  },

  /** 手动添加：从相册选一张照片作为物品图（仅记录，不发起 AI 识别），可重复点击更换 */
  pickFromAlbum() {
    const that = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success(res: any) {
        const raw = res.tempFiles[0].tempFilePath
        if (!raw) return
        const app = getApp<IAppOption>()
        if (app && app.globalData) {
          // 与页面 data 双写：去位置选择页返回后（onShow）照片仍在
          app.globalData.recognizeImg = raw
          app.globalData.recognizeImgFull = raw
          app.globalData.recognizePending = false
        }
        that.setData({ img: raw })
      },
      fail() { /* 用户取消，静默 */ }
    })
  },

  onShow() {
    const app = getApp<IAppOption>()
    const loc: string[] = (app && app.globalData && app.globalData.locationPath) || []
    if (loc.length) {
      this.setData({ locText: joinPath(loc) })
    }
    if (app && app.globalData && (app.globalData.recognizeImgFull || app.globalData.recognizeImg)) {
      // 结果页优先展示原图（aspectFit 完整显示），裁好的方图供保存后列表使用
      this.setData({ img: app.globalData.recognizeImgFull || app.globalData.recognizeImg })
    }
    // 仅从相机/添加页进入时发起识别；从位置选择页返回不重复调 AI
    if (app && app.globalData && app.globalData.recognizePending && app.globalData.recognizeImg) {
      app.globalData.recognizePending = false
      this.runRecognize(app.globalData.recognizeImgFull || app.globalData.recognizeImg)
    }
  },

  runRecognize(imgPath: string) {
    const that = this
    this.setData({ recognizing: true, aiFailed: false, aiNote: '' })
    toDataUrl(imgPath).then(function (dataUrl) {
      // 与后端 /ai/recognize 的 4MB 检查对齐（dataUrl 长度 × 3/4 = 二进制体积）；
      // 超限时后端也会返回 413，此处提前拦截省一次请求
      if (dataUrl.length * 0.75 > 4 * 1024 * 1024) {
        that.setData({ recognizing: false, aiFailed: true, aiNote: '图片过大，请手动填写' })
        return undefined
      }
      return recognize(dataUrl).then(function (res) {
        if (isApiError(res)) {
          that.setData({ recognizing: false, aiFailed: true, aiNote: 'AI 暂时不可用，请手动填写' })
          return undefined
        }
        const r = res as RecognizeResult
        const low = typeof r.confidence === 'number' && r.confidence < 0.6
        that.setData({
          recognizing: false,
          score: Math.round((r.confidence || 0) * 100),
          aiResultId: r.aiResultId || '',
          aiNote: low ? '识别置信度较低，请仔细核对' : '',
          draft: {
            name: r.name || '',
            brand: r.brand || '',
            model: r.model || '',
            category: r.category || '',
            color: r.color || '',
            desc: r.description || '',
            tags: Array.isArray(r.tags) ? r.tags.slice(0, 10) : []
          }
        })
        return undefined
      })
    }).catch(function (e: any) {
      that.setData({ recognizing: false, aiFailed: true, aiNote: (e && e.message) || '识别失败，请手动填写' })
    })
  },

  /** AI 结果只是草稿：名称点击可改（必填） */
  editName() {
    const that = this
    wx.showModal({
      title: '物品名称',
      editable: true,
      placeholderText: (this.data as any).draft.name || '请输入名称',
      success(res: any) {
        if (!res.confirm) return
        const name = (res.content || '').trim()
        if (!name) {
          wx.showToast({ title: '名称不能为空', icon: 'none' })
          return
        }
        // AI 草稿可能超长：未改动时放行，用户手输超长才拦截
        if (name !== ((that.data as any).draft.name || '')) {
          const lenErr = checkName(name, '物品名称')
          if (lenErr) {
            wx.showToast({ title: lenErr, icon: 'none' })
            return
          }
        }
        that.setData({ 'draft.name': name })
      }
    })
  },

  removeTag(e: any) {
    const t = e.currentTarget.dataset.t
    const tags = ((this.data as any).draft.tags || []).filter(function (x: string) { return x !== t })
    this.setData({ 'draft.tags': tags })
  },

  addTag() {
    const that = this
    wx.showModal({
      title: '添加标签',
      editable: true,
      placeholderText: '如：无线、办公',
      success(res: any) {
        if (!res.confirm) return
        const t = (res.content || '').trim()
        if (!t) return
        const tagErr = checkTag(t)
        if (tagErr) {
          wx.showToast({ title: tagErr, icon: 'none' })
          return
        }
        const tags = ((that.data as any).draft.tags || []).slice()
        if (tags.indexOf(t) < 0) tags.push(t)
        that.setData({ 'draft.tags': tags })
      }
    })
  },

  changeLoc() {
    wx.navigateTo({ url: '/pages/location/location' })
  },

  save() {
    const d = (this.data as any).draft
    const app = getApp<IAppOption>()
    const locationId = (app && app.globalData && app.globalData.locationId) || ''
    if (!d.name.trim()) {
      wx.showToast({ title: '请先点击名称填写', icon: 'none' })
      return
    }
    if (!locationId) {
      wx.showToast({ title: '请选择存放位置', icon: 'none' })
      return
    }
    if (this.data.saving) return
    const that = this
    this.setData({ saving: true })
    // 标签：去空格/去重/截断 10 个（标签影响「同类物品」与「你可能还想找」）
    const tags = (d.tags || [])
      .map(function (t: string) { return (t || '').trim() })
      .filter(function (t: string, i: number, arr: string[]) { return t && arr.indexOf(t) === i })
      .slice(0, 10)
    const body: any = {
      name: d.name.trim(),
      category: d.category || '未分类',
      brand: d.brand || null,
      model: d.model || null,
      color: d.color || null,
      description: d.desc || null,
      spaceId: locationId,
      tags: tags
    }
    if (this.data.aiResultId) body.aiResultId = this.data.aiResultId
    // 物品照片走 /upload（契约 v1.3 §5.2）入库；上传失败不阻塞保存（imageUrl 可空），
    // 但必须显式告知用户照片未存——编辑弹层无换图入口，静默丢图不可恢复
    const finishSave = function (imageUrl: string, uploadFailed: boolean) {
      if (imageUrl) body.imageUrl = imageUrl
      createItem(body).then(function () {
        if (app && app.globalData) {
          app.globalData.recognizeImg = ''
          app.globalData.recognizeImgFull = ''
          app.globalData.locationPath = []
          app.globalData.locationId = ''
        }
        that.setData({ saving: false })
        if (uploadFailed) {
          wx.showToast({ title: '已保存，但照片上传失败', icon: 'none', duration: 2500 })
        } else {
          wx.showToast({ title: '已保存', icon: 'success' })
        }
        setTimeout(function () {
          wx.switchTab({ url: '/pages/items/items' })
        }, 2000)
      }).catch(function () {
        that.setData({ saving: false })
      })
    }
    if (this.data.img) {
      uploadImage(this.data.img)
        .then(function (up) { finishSave(up.imageUrl, false) })
        .catch(function () { finishSave('', true) })
    } else {
      finishSave('', false)
    }
  }
})
