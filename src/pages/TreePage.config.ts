// src/pages/TreePage.config.ts
// TreePageの見た目に関する調整値をまとめたもの。
// カードサイズや間隔を変えたいだけならこのファイルの値を編集すればよい。
//
// 以前はzoomの初期値を下げてCSSの transform: scale() で画面全体を縮小して
// 見える範囲を広げていたが、transformによる縮小は文字がぼやける（サブピクセルの
// フォントヒンティングが効かなくなる）ため、代わりにここの寸法・TaskNodeCard.tsxの
// フォントサイズ自体を実測0.8倍した値に置き換えて対応している。zoomの初期値は
// 100%（=変形なし）に戻し、必要な追加ズームだけユーザー操作に委ねる

import type { TreeLayoutConfig } from '../lib/tree';

/** カードサイズ・列間隔など、木構造レイアウト計算に渡す寸法設定（元の値の0.8倍） */
export const TREE_LAYOUT_CONFIG: TreeLayoutConfig = {
  cardWidth: 196,
  // ルートは兄弟が存在せず横方向の競合が起きないため、目立たせるために子カードより
  // 広くしている。接続線(ConnectionsOverlay.tsx)は実測DOM座標ベースで描画されるため、
  // ここを変えても線がずれることはない
  rootWidth: 216,
  gapX: 40,
  dropZoneHeight: 14.4,
  defaultNodeHeight: 60.8,
  defaultRootHeight: 96,
};

/** キャンバス端の余白(px)（元の48pxの0.8倍） */
export const CANVAS_PADDING = 38.4;

// タスク集中パネル（RightDrawerPanel.tsx）の最大幅と合わせた値。ドロワーが開くと
// 画面右端のノードが隠れてしまうが、キャンバスの横スクロール範囲がノードの存在する
// 範囲までしかないため、それ以上右へスクロールしてドロワーの裏から逃がすことが
// できなかった。ズーム倍率に関わらずドロワー自体は画面上で常に同じ幅なので、この
// 余白もズームでスケールさせず画面ピクセル固定で加算する
export const DRAWER_RESERVED_WIDTH = 420;

/** ノードが閉じて消えるフェードアウトの所要時間(ms) */
export const EXIT_TRANSITION_MS = 200;

// ── 画面比率（ズーム）設定 ───────────────────────────────────────────────
export const MIN_ZOOM = 0.3;
export const MAX_ZOOM = 1.5;
export const ZOOM_STEP = 0.1;
/** ツリー画面を開いたときの初期ズーム。密度はTREE_LAYOUT_CONFIG側で確保したので、
 * ここはtransformによる引き伸ばし/縮小を伴わない等倍（100%）を初期値にする */
export const DEFAULT_ZOOM = 1;
