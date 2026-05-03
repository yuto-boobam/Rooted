import type { TaskNode } from '../types';

type Counts = { total: number; completed: number };

/**
 * ツリーを再帰的に辿り、末端ノード（leaf）の総数と完了数を数える。
 * 「完了率 = 完了leaf数 / 全leaf数」で進捗を算出する。
 */
function countLeaves(node: TaskNode): Counts {
  // 子がいない = leaf ノード
  if (node.children.length === 0) {
    return { total: 1, completed: node.completed ? 1 : 0 };
  }
  // 子がいる = 子の集計を合算する
  return node.children.reduce<Counts>(
    (acc, child) => {
      const c = countLeaves(child);
      return { total: acc.total + c.total, completed: acc.completed + c.completed };
    },
    { total: 0, completed: 0 }
  );
}

/** ルートノードから進捗率（0–100の整数）を計算して返す */
export function calcProgress(root: TaskNode): number {
  const { total, completed } = countLeaves(root);
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * 特定ノード以下の進捗率を計算する（列表示での部分的な表示に使用）
 */
export function calcNodeProgress(node: TaskNode): number {
  return calcProgress(node);
}
