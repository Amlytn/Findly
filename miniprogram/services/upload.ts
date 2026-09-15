/**
 * 图片上传（契约 v1.3 §5.2）：multipart 字段 file，仅 png/jpeg/webp、≤4MB（后端 413）。
 * 识别页保存物品前调用，返回入库用的相对路径 /uploads/xxx.jpg。
 */
import { API_BASE } from './request'
import { getToken } from './auth'
import type { UploadResponse } from '../types/api'

export function uploadImage(filePath: string): Promise<UploadResponse> {
  const doUpload = (p: string) => new Promise<UploadResponse>(function (resolve, reject) {
    wx.uploadFile({
      url: API_BASE + '/upload',
      filePath: p,
      name: 'file',
      header: getToken() ? { Authorization: 'Bearer ' + getToken() } : {},
      timeout: 20000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data) as UploadResponse)
          } catch {
            reject({ statusCode: 0, message: '上传响应解析失败' })
          }
          return
        }
        let message = '上传失败（' + res.statusCode + '）'
        try { message = JSON.parse(res.data).message || message } catch { /* 保留默认文案 */ }
        reject({ statusCode: res.statusCode, message })
      },
      fail() { reject({ statusCode: 0, message: '网络不可用，上传失败' }) }
    })
  })
  // 与识别同规格压缩，控制存储与流量
  return new Promise<UploadResponse>(function (resolve) {
    wx.compressImage({
      src: filePath,
      quality: 80,
      success: (r) => resolve(doUpload(r.tempFilePath)),
      fail: () => resolve(doUpload(filePath))
    })
  })
}
