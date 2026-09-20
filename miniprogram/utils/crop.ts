/**
 * 图片归一化工具：入库前的裁切与压缩。
 */
export function cropToSquare(src: string, out = 600): Promise<string> {
  return new Promise(function (resolve, reject) {
    wx.getImageInfo({
      src: src,
      success: function (info: any) {
        const size = Math.min(info.width, info.height)
        const sx = (info.width - size) / 2
        const sy = (info.height - size) / 2
        try {
          const canvas = wx.createOffscreenCanvas({ type: '2d', width: out, height: out })
          const ctx = canvas.getContext('2d')
          const img = canvas.createImage()
          img.onload = function () {
            ctx.drawImage(img, sx, sy, size, size, 0, 0, out, out)
            wx.canvasToTempFilePath({
              canvas: canvas,
              success: function (res: any) {
                resolve(res.tempFilePath)
              },
              fail: reject
            })
          }
          img.onerror = reject
          img.src = info.path
        } catch (e) {
          reject(e)
        }
      },
      fail: reject
    })
  })
}

/**
 * 质量压缩一次；失败时回退原图（压缩是优化不是前置条件）。
 * compressedWidth/Height 同时给到可等比缩放分辨率。
 */
export function compressOnce(
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

/**
 * 计算等比缩放目标尺寸（长边 ≤ maxEdge）；本身已在限内则原样返回。
 */
export function calcTargetSize(origW: number, origH: number, maxEdge: number) {
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
 * 上传前归一化：读原图尺寸，长边压到 ≤ maxEdge 并压缩画质。
 * 大分辨率照片不限尺寸直传会撞后端 4MB 上限（413），识别路径早有此约束，上传路径对齐。
 */
export function shrinkToMaxEdge(src: string, maxEdge = 1200, quality = 80): Promise<string> {
  return new Promise<string>(function (resolve) {
    wx.getImageInfo({
      src,
      success(info: any) {
        const { width, height } = calcTargetSize(info.width, info.height, maxEdge)
        resolve(compressOnce(src, quality, width, height))
      },
      fail() {
        // 尺寸信息读不到时仅压质量，保底走一次
        resolve(compressOnce(src, quality))
      }
    })
  })
}
