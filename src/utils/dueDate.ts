// src/utils/dueDate.ts

/** 期限日（YYYY-MM-DD）までの残り日数（0 = 当日、負の値 = 超過）を返す */
export function daysUntil(dueDate: string): number {
  const [year, month, day] = dueDate.split('-').map(Number);
  const target = new Date(year, month - 1, day).getTime();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

/** 期限日（YYYY-MM-DD）を "M/D" 表記に変換する */
export function formatDueDateShort(dueDate: string): string {
  const [, month, day] = dueDate.split('-');
  if (!month || !day) return dueDate;

  return `${Number(month)}/${Number(day)}`;
}
