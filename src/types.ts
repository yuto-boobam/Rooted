// src/types.ts
// アプリ全体で使用する TypeScript の型定義

/** 優先度の数値（1位, 2位, 3位...）または未設定 */
export type PriorityOrder = number | null;

/** カレンダーの表示モード */
export type CalendarViewMode = 'weekly' | 'monthly';

/** 表示するページ */
export type View = 'dashboard' | 'tree';

/** 1つのタスクノード（木の節 or 葉） */
export type TaskNode = {
  // --- 基本情報 ---
  id: string;
  title: string;
  memo: string; // 概要メモ（1行ほどの短い説明）
  detailMemo: string; // 詳細メモ（具体的な手順・内容など）

  // --- 進捗・完了フラグ ---
  completed: boolean;
  progress: number; // 0–100

  // --- 優先タスク ---
  isPriority: boolean;
  priorityOrder: PriorityOrder;

  // --- 期限 ---
  dueDate: string | null; // YYYY-MM-DD
  backgroundColor: string | null; // 期限接近時に UI 側で使う背景色

  // --- 日付と登録者管理 ---
  createdBy: string;
  createdAt: string;
  completedAt: string | null;

  // --- 子ノード ---
  children: TaskNode[];
};

/** 1つのプロジェクト */
export type Project = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  progress: number;
  rootTask: TaskNode;
};

/** 右側サイドパネルのトグル UI 状態 */
export type RightPanelState = {
  isOpen: boolean;
  isTodayDueOpen: boolean;
  isPriorityListOpen: boolean;
  isCalendarOpen: boolean;
  calendarMode: CalendarViewMode;
};

/** プロジェクトカードのカラーパレット */
export const PROJECT_COLORS = [
  '#3b82f6',
  '#22c55e',
  '#a855f7',
  '#f97316',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#ef4444',
] as const;

/** プロジェクトカードの絵文字アイコン */
export const PROJECT_ICONS = [
  '📁',
  '📚',
  '🎯',
  '💻',
  '🌱',
  '🔬',
  '🎨',
  '📊',
  '🚀',
  '💡',
] as const;

// コピー機能: ノード移動用のD&Dペイロード（application/jsonの{id,parentId,index}）とは
// 完全に独立させ、コピー内容の貼り付けドラッグだけを既存のドロップ処理から区別するための
// 専用MIMEタイプ。dataTransfer.types はdrop前でも安全に参照できるため判定に使う
export const COPY_PASTE_MIME_TYPE = 'application/x-rooted-copy-paste';
