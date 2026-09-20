/**
 * 空间路径的单一来源：分隔符、拼接、服务端 path 的解析/显示转换只在此处定义。
 * 服务端 path 固定用 ' → '（server/src/common/path.util.ts），前端显示统一为 PATH_SEP。
 */
export const PATH_SEP = ' › '

const SERVER_PATH_SEP = ' → '

/** 拼接祖先路径链（含自身） */
export function joinPath(parts: string[]): string {
  return parts.join(PATH_SEP)
}

/** 服务端 path → 前端显示样式（详情/搜索结果/统计仍在展示服务端字符串，此处是唯一转换点） */
export function toDisplayPath(path?: string | null): string {
  return path ? path.split(SERVER_PATH_SEP).join(PATH_SEP) : ''
}

/** 服务端 path 取末级空间名（搜索结果无 space 对象，契约如此，此处是唯一解析点） */
export function serverPathLeaf(path?: string | null): string {
  if (!path) return ''
  const parts = path.split(SERVER_PATH_SEP)
  return parts[parts.length - 1]
}
