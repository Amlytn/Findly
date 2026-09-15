/**
 * @author james-wu66
 * Findly 后端 · 2026-09-15
 */
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
  while (cur && guard++ < 20) {
    chain.unshift(cur.name);
    cur = cur.parentId ? byId.get(cur.parentId) : undefined;
  }
  return chain.join(' → ');
}
