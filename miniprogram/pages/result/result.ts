import { recognize } from '../../services/ai'
import { createItem } from '../../services/items'
import { isApiError } from '../../services/request'
import { RecognizeResult } from '../../types/api'

/** 读临时文件转 dataURL；先压缩一次（quality 80）控制体积 */
function toDataUrl(path: string): Promise<string> {
  const doRead = (p: string) => new Promise<string>(function (resolve, reject) {
    wx.getFileSystemManager().readFile({
      filePath: p,
      encoding: 'base64',
      success(res: any) { resolve('data:image/jpeg;base64,' + res.data) },
      fail() { reject({ statusCode: 0, message: '图片读取失败' }) }
    })
  })
  return new Promise<string>(function (resolve) {
    wx.compressImage({
      src: path,
      quality: 80,
      success: (r: any) => { resolve(doRead(r.tempFilePath)) },
      fail: () => { resolve(doRead(path)) }
    })
  })
}

Page({
  data: {
    img: '',
    score: 0,
    aiFailed: false,
    aiNote: '',
    draft: { name: '', brand: '', category: '', color: '', desc: '', tags: [] as string[] },
    locText: '未选择位置',
    locId: '',
    aiResultId: '',
    recognizing: false,
    saving: false
  },

  onShow() {
    const app = getApp() as any
    const loc: string[] = app.globalData.locationPath || []
    if (loc.length) {
      this.setData({ locText: loc.join('  ›  '), locId: app.globalData.locationId || '' })
    }
    if (app.globalData.recognizeImg) {
      this.setData({ img: app.globalData.recognizeImg })
    }
    if (app.globalData.recognizePending && app.globalData.recognizeImg) {
      app.globalData.recognizePending = false
      this.runRecognize(app.globalData.recognizeImg)
    }
  },

  runRecognize(imgPath: string) {
    const that = this
    this.setData({ recognizing: true, aiFailed: false, aiNote: '' })
    toDataUrl(imgPath).then(function (dataUrl) {
      if (dataUrl.length * 0.75 > 4 * 1024 * 1024) {
        that.setData({ recognizing: false, aiFailed: true, aiNote: '图片过大，请手动填写' })
        return
      }
      return recognize(dataUrl).then(function (res) {
        if (isApiError(res)) {
          that.setData({ recognizing: false, aiFailed: true, aiNote: 'AI 暂时不可用，请手动填写' })
          return
        }
        const r = res as RecognizeResult
        const low = typeof r.confidence === 'number' && r.confidence < 0.6
        that.setData({
          recognizing: false,
          score: Math.round((r.confidence || 0) * 100),
          aiResultId: r.aiResultId || '',
          aiFailed: false,
          aiNote: low ? '识别置信度较低，请仔细核对' : '',
          draft: {
            name: r.name || '',
            brand: r.brand || '',
            category: r.category || '',
            color: r.color || '',
            desc: r.description || '',
            tags: Array.isArray(r.tags) ? r.tags.slice(0, 10) : []
          }
        })
      })
    }).catch(function (e: any) {
      that.setData({ recognizing: false, aiFailed: true, aiNote: e.message || '识别失败，请手动填写' })
    })
  },

  /** 草稿可编辑：点名称行改名称（AI 结果只是草稿，保存前允许修改） */
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
        that.setData({ 'draft.name': name })
      }
    })
  },

  /** 移除单个标签（标签影响「同类物品」与「你可能还想找」，允许删改） */
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
    if (!d.name.trim()) {
      wx.showToast({ title: '请先填写名称', icon: 'none' })
      return
    }
    if (!this.data.locId) {
      wx.showToast({ title: '请选择存放位置', icon: 'none' })
      return
    }
    if (this.data.saving) return
    const that = this
    this.setData({ saving: true })
    // 标签：去空格/去重/截断 10 个（缺陷修复：AI 标签必须随物品入库，否则 related/suggestions 命中不了）
    const tags = (d.tags || [])
      .map(function (t: string) { return (t || '').trim() })
      .filter(function (t: string, i: number, arr: string[]) { return t && arr.indexOf(t) === i })
      .slice(0, 10)
    const body: any = {
      name: d.name.trim(),
      category: d.category || '未分类',
      brand: d.brand || null,
      color: d.color || null,
      description: d.desc || null,
      spaceId: this.data.locId,
      tags: tags
    }
    if (this.data.aiResultId) body.aiResultId = this.data.aiResultId
    createItem(body).then(function () {
      const app = getApp() as any
      app.globalData.recognizeImg = ''
      app.globalData.locationPath = []
      app.globalData.locationId = ''
      that.setData({ saving: false })
      wx.showToast({ title: '已保存', icon: 'success' })
      setTimeout(function () {
        wx.switchTab({ url: '/pages/items/items' })
      }, 800)
    }).catch(function () {
      that.setData({ saving: false })
    })
  }
})
