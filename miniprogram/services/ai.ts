/** AI 识别接口（api.md 第 4 节）。503 属设计内降级，silent 交由页面兜底 */
import request from './request'
import { RecognizeResult } from '../types/api'

/** imageBase64 必须为 data:image/png|jpeg|webp;base64, 前缀串，压缩后 ≤4MB
 * （后端 6MB body 限制 + 4MB 检查，超限返回 413） */
export function recognize(imageBase64: string): Promise<RecognizeResult> {
  return request<RecognizeResult>('/ai/recognize', {
    method: 'POST',
    data: { imageBase64 },
    silent: true
  })
}
