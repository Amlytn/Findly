/**
 * 录入侧长度校验的唯一来源。
 * 阈值是产品决策（后端未设同值约束），如需调整只改这里。
 */
export const NAME_MAX = 30
export const TAG_MAX = 10

/** 名称校验：超限返回错误文案，'' 表示通过 */
export function checkName(text: string, label: string): string {
  return text.length > NAME_MAX ? label + '不能超过 ' + NAME_MAX + ' 个字' : ''
}

/** 标签校验：超限返回错误文案，'' 表示通过 */
export function checkTag(text: string): string {
  return text.length > TAG_MAX ? '标签不能超过 ' + TAG_MAX + ' 个字' : ''
}
