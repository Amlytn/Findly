/**
 * 图片上传（契约 v1.3 §5.2）：multipart 字段 file，仅 png/jpeg/webp、≤4MB（后端 413）。
 * 识别页保存物品前调用，返回入库用的相对路径 /uploads/xxx.jpg。
 */
import { getApiBase } from './config'
import { getToken } from './auth'
import { shrinkToMaxEdge } from '../utils/crop'
import type { UploadResponse } from '../types/api'

export function uploadImage(filePath: string): Promise<UploadResponse> {
  const doUpload = (p: string) => new Promise<UploadResponse>(function (resolve, reject) {
    const token = getToken()
    const header: Record<string, string> = {}
    if (token) {
      header.Authorization = 'Bearer ' + token
    }
    wx.uploadFile({
      url: getApiBase() + '/upload',
      filePath: p,
      name: 'file',
      header,
      timeout: 20000,
      success(res: { statusCode: number; data: string }) {
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
  // 与识别同规格压缩（长边 ≤1200px + 画质），大图直传会撞 4MB 上限
  return shrinkToMaxEdge(filePath, 1200, 80).then(doUpload)
}
