// アプリ全体で使用するTypeScriptの型定義

/** 優先度の数値（1位, 2位, 3位...）または未設定 */
export type PriorityOrder = number | null;

/** カレンダーの表示モード */
export type CalendarViewMode = 'weekly' | 'monthly';

/** 1つのタスクノード（木の節 or 葉） */
export type TaskNode = {
  // --- 基本情報 ---
  id: string;
  title: string;
  memo: string;          // 概要メモ（1行ほどの短い説明）
  detailMemo: string;    // 詳細メモ（具体的な手順・内容など）

  // --- 進捗・完了フラグ ---
  completed: boolean;    // 完了フラグ
  progress: number;      // 0–100（進捗率）

  // --- 【スライド要件】優先タスク（枠線の色を変更・順位付け） ---
  isPriority: boolean;         // 優先フラグ（trueなら枠線色を変更＆右パネルに表示）
  priorityOrder: PriorityOrder; // 優先タスク内での順位（1, 2, 3...）

  // --- 【スライド要件】期限（内側の背景色を変更） ---
  dueDate: string | null;      // 期限日（YYYY-MM-DD）
  backgroundColor: string | null; // 期限接近時に変化する「内側の色」（黄色・黒以外の両モード対応色）

  // --- 【スライド要件】日付と登録者管理 ---
  createdBy: string;           // 登録したユーザーのニックネーム
  createdAt: string;           // 作成日時（ISO文字列）
  completedAt: string | null;   // 達成日時（カレンダーの「その日達成したタスク」抽出用）

  // --- 子ノード ---
  children: TaskNode[];
};

/** 1つのプロジェクト */
export type Project = {
  id: string;
  title: string;
  description: string;
  icon: string;        // 絵文字アイコン
  color: string;       // プロジェクトのアクセントカラー (hex)
  starred: boolean;    // お気に入りフラグ
  createdBy: string;   // プロジェクト作成者のニックネーム
  createdAt: string;   // 作成日時
  updatedAt: string;   // 最終更新日時
  progress: number;    // 0–100
  rootTask: TaskNode;  // 木構造 of ルートノード
};

/** 表示するページ */
export type View = 'dashboard' | 'tree';

/** 右側サイドパネルのトグル（開閉）UI状態 */
export type RightPanelState = {
  isOpen: boolean;            // 右パネル自体の開閉
  isTodayDueOpen: boolean;    // 「今日が期限のタスク」トグルの開閉
  isPriorityListOpen: boolean; // 「優先的タスク」トグルの開閉
  isCalendarOpen: boolean;    // 「カレンダー」トグルの開閉
  calendarMode: CalendarViewMode; // 'weekly' | 'monthly'
};

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

