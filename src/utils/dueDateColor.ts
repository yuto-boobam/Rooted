// src/utils/dueDateColor.ts
// 期限までの残り日数を、橙色（7日前）→赤色（当日）→深紅（超過）と
// 連続的に変化するグラデーション色に変換する。
// 期限に余裕がある／未設定の場合は null を返し、呼び出し側で
// var(--text-primary)（ライトモード実装時は黒に切り替わる想定）にフォールバックする。

export type DueUrgencyColors = {
  /** バッジや枠線など、強調表示に使うアクセントカラー */
  accent: string;
  /** カード背景にうっすら重ねる背景色 */
  background: string;
};

const SOON_HUE = 24; // 橙色（7日前）※黄色寄りにならないよう純度の高い橙にする
const TODAY_HUE = 0; // 赤色（当日）
const OVERDUE_HUE = 350; // 深紅（期限超過）

/**
 * diffDays: 期限までの残り日数（0 = 当日、負の値 = 超過）
 * 7日を超えて先の場合は null（色付けなし）。
 */
export function getDueUrgencyColors(diffDays: number): DueUrgencyColors | null {
  if (diffDays > 7) return null;

  if (diffDays < 0) {
    return {
      accent: `hsl(${OVERDUE_HUE}, 88%, 46%)`,
      background: `hsla(${OVERDUE_HUE}, 88%, 46%, 0.22)`,
    };
  }

  // ratio: 0（7日前）→ 1（当日）
  const ratio = (7 - Math.min(diffDays, 7)) / 7;
  const hue = SOON_HUE - (SOON_HUE - TODAY_HUE) * ratio;

  return {
    accent: `hsl(${hue}, 85%, 55%)`,
    background: `hsla(${hue}, 85%, 55%, ${(0.1 + 0.12 * ratio).toFixed(3)})`,
  };
}
