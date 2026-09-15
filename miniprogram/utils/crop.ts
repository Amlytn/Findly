/**
 * 图片入库归一化：居中裁切为 1:1 方图
 * 用户拍照/相册选图比例参差，保存前统一裁成正方形，
 * 列表缩略图即可用固定 1:1 容器 + aspectFill 严丝合缝地展示。
 * 取短边居中裁切（AI 识别场景物品基本都在画面中心）。
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
