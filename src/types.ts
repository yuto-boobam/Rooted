// アプリ全体で使用するTypeScriptの型定義

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
  completed: boolean; // 完了フラグ
  progress: number; // 0–100（進捗率）

  // --- 優先タスク ---
  isPriority: boolean; // trueなら枠線色をUI側で変更＆右パネルに表示
  priorityOrder: PriorityOrder; // 優先タスク内での順位（1, 2, 3...）

  // --- 期限 ---
  dueDate: string | null; // 期限日（YYYY-MM-DD）
  backgroundColor: string | null; // 期限接近時に変化する「内側の色」

  // --- 日付と登録者管理 ---
  createdBy: string; // 登録したユーザーのニックネーム
  createdAt: string; // 作成日時（ISO文字列）
  completedAt: string | null; // 達成日時

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
  starred: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  progress: number;
  rootTask: TaskNode;
};

/** 右側サイドパネルのトグルUI状態 */
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
