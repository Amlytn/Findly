/** AI 识别接口（api.md 第 4 节）。503 属设计内降级，silent 交由页面兜底 */
import request from './request'
import { RecognizeResult } from '../types/api'

/** imageBase64 必须为 data:image/png|jpeg|webp;base64, 前缀串；识别页预检 ≤95KB
 * （适配后端 body-parser 默认 100KB JSON 限制；后端 B2 调大限制后可放宽） */
export function recognize(imageBase64: string): Promise<RecognizeResult> {
  return request<RecognizeResult>('/ai/recognize', {
    method: 'POST',
    data: { imageBase64 },
    silent: true
  })
}
