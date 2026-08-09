// src/pages/TreePage.config.ts
// TreePageの見た目に関する調整値をまとめたもの。
// カードサイズや間隔を変えたいだけならこのファイルの値を編集すればよい。

import type { TreeLayoutConfig } from '../lib/tree';

/** カードサイズ・列間隔など、木構造レイアウト計算に渡す寸法設定 */
export const TREE_LAYOUT_CONFIG: TreeLayoutConfig = {
  cardWidth: 245,
  rootWidth: 220,
  gapX: 50,
  dropZoneHeight: 18,
  defaultNodeHeight: 76,
  defaultRootHeight: 110,
};

/** キャンバス端の余白(px) */
export const CANVAS_PADDING = 48;

/** ノードが閉じて消えるフェードアウトの所要時間(ms) */
export const EXIT_TRANSITION_MS = 200;

// ── 画面比率（ズーム）設定 ───────────────────────────────────────────────
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 1.5;
export const ZOOM_STEP = 0.1;
