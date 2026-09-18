import { getStats } from '../../services/stats'
import type { StatsResponse, StatsByTaskType } from '../../types/api'

/** 数字千分位格式化（如 4896 -> 4,896） */
function formatNumber(n: number): string {
  if (typeof n !== 'number' || isNaN(n)) return '0'
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** 估算成本格式化（保留4位小数，不足补零） */
function formatCost(cost: number): string {
  if (typeof cost !== 'number' || isNaN(cost)) return '¥0.0000'
  return '¥' + Number(cost).toFixed(4)
}

/** 百分比格式化（0.125 -> 12.5%） */
function formatPercent(rate: number): string {
  if (typeof rate !== 'number' || isNaN(rate)) return '0.0%'
  return (rate * 100).toFixed(1) + '%'
}

/** 平均耗时格式化（null 时显示 "—"） */
function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined || isNaN(ms)) return '—'
  return ms + ' ms'
}

/** 任务类型转换为中文展示名 */
function getTaskTypeName(type: string): string {
  switch (type) {
    case 'recognize':
      return '识图'
    case 'parse-query':
      return '搜索词解析'
    default:
      return type
  }
}

/** 格式化生成时间（ISO -> YYYY-MM-DD HH:mm） */
function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => (n < 10 ? '0' + n : '' + n)
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes())
    )
  } catch {
    return iso
  }
}

export interface TaskDisplayItem {
  taskType: string
  name: string
  calls: number
  tokensText: string
  costText: string
}

Page({
  data: {
    loading: true,
    error: '',
    totalCalls: 0,
    totalTokensText: '0',
    estimatedCostText: '¥0.0000',
    degradedRateText: '0.0%',
    cacheHitRateText: '0.0%',
    avgDurationText: '—',
    taskList: [] as TaskDisplayItem[],
    generatedAtText: ''
  },

  onLoad() {
    this.fetch()
  },

  onPullDownRefresh() {
    this.fetch(true)
  },

  retry() {
    this.fetch()
  },

  fetch(isPullDown = false) {
    const that = this
    if (!isPullDown) {
      this.setData({ loading: true, error: '' })
    }

    getStats()
      .then(function (res: StatsResponse) {
        const taskList: TaskDisplayItem[] = (res.byTaskType || []).map(function (item: StatsByTaskType) {
          return {
            taskType: item.taskType,
            name: getTaskTypeName(item.taskType),
            calls: item.calls,
            tokensText: formatNumber(item.tokens),
            costText: formatCost(item.cost)
          }
        })

        that.setData({
          loading: false,
          error: '',
          totalCalls: res.totalCalls || 0,
          totalTokensText: formatNumber(res.totalTokens || 0),
          estimatedCostText: formatCost(res.estimatedCost || 0),
          degradedRateText: formatPercent(res.degradedRate || 0),
          cacheHitRateText: formatPercent(res.cacheHitRate || 0),
          avgDurationText: formatDuration(res.avgDurationMs),
          taskList: taskList,
          generatedAtText: formatTime(res.generatedAt)
        })
        if (isPullDown) {
          wx.stopPullDownRefresh()
        }
      })
      .catch(function (e: any) {
        that.setData({
          loading: false,
          error: (e && e.message) || '加载用量统计失败'
        })
        if (isPullDown) {
          wx.stopPullDownRefresh()
        }
      })
  },

  /** 引导空态跳转录入 */
  goCamera() {
    wx.navigateTo({ url: '/pages/camera/camera' })
  }
})
