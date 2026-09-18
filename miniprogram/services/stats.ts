/**
 * 用量统计接口（契约 T7 / B02）：GET /api/v1/stats
 */
import request from './request'
import type { StatsResponse } from '../types/api'

export function getStats(): Promise<StatsResponse> {
  return request<StatsResponse>('/stats')
}
