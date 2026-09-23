/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
/** 空间树最大层级。C21：这个数以前只存在于拼路径的 guard（20）里，
 *  环检测另用一个 50 —— 两个数不一致导致 20~50 层之间路径被静默截断、超过 50 层则成环漏判。
 *  现在由 spaces.service 在**写入时**就用它拦，正常数据到不了这个深度，下面的 guard 只作兜底。 */
export const MAX_SPACE_DEPTH = 20;

/** 位置路径：向上回溯 parentId 拼成 "我的家 → 书房 → 书桌 → 右侧抽屉"（search 与 items 共用） */
export function pathOf(
  spaces: { id: string; parentId: string | null; name: string }[],
  id: string | null,
): string {
  if (!id) return '未归位';
  const byId = new Map(spaces.map((s) => [s.id, s]));
  const chain: string[] = [];
  let cur = byId.get(id);
  let guard = 0;
  while (cur && guard++ < MAX_SPACE_DEPTH) {
    chain.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.join(' → ');
}
