// アプリ全体で使用するTypeScriptの型定義

/** 1つのタスクノード（木の節 or 葉） */
export type TaskNode = {
  id: string;
  title: string;
  memo: string;        // 1行概要メモ
  completed: boolean;  // 完了フラグ（leafのみ有効）
  progress: number;    // 0–100（refreshProgressボタンで再計算、それ以外は変化しない）
  children: TaskNode[];
};

/** 1つのプロジェクト */
export type Project = {
  id: string;
  title: string;
  description: string;
  icon: string;        // 絵文字アイコン
  color: string;       // アクセントカラー (hex)
  starred: boolean;    // お気に入りフラグ
  createdAt: string;   // ISO文字列
  updatedAt: string;   // ISO文字列
  progress: number;    // 0–100（更新ボタンで再計算）
  rootTask: TaskNode;  // 木構造のルートノード
};

/** 表示するページ */
export type View = 'dashboard' | 'tree';

/** プロジェクトカードのカラーパレット */
export const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#f97316', // orange
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
  '#ef4444', // red
] as const;

/** プロジェクトカードの絵文字アイコン */
export const PROJECT_ICONS = ['📁', '📚', '🎯', '💻', '🌱', '🔬', '🎨', '📊', '🚀', '💡'] as const;
