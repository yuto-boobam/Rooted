// src/components/AccordionSection.tsx
// アイコン＋タイトル＋件数バッジ＋開閉シェブロンの、開閉可能なセクション見出し。
// サイドドロワー内の各リスト（今日が期限のタスク／優先的タスク／プロジェクト別 等）で共用する。

import type { CSSProperties, ReactNode } from 'react';

type AccordionSectionProps = {
  title: string;
  icon: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;

  // ゲスト向け誘導ガイド用。指定時、セクション全体を光らせ、見出しの上に説明の
  // 吹き出しを出す。onGuideNextを渡すと吹き出しに「次へ」ボタンが付く
  // (このセクションは開閉に関わらず既に開いた状態で初期表示されるため、これ以上
  // ユーザーに操作させる要素が無く、案内を読んだら手動で次へ進んでもらう)
  isGuideTarget?: boolean;
  guideHintText?: string;
  onGuideNext?: () => void;
};

export default function AccordionSection({
  title,
  icon,
  count,
  isOpen,
  onToggle,
  children,
  isGuideTarget = false,
  guideHintText,
  onGuideNext,
}: AccordionSectionProps) {
  return (
    <section
      style={styles.section}
      className={isGuideTarget ? 'tutorial-spotlight-ring' : undefined}
    >
      <button
        type="button"
        style={{
          ...styles.sectionHeader,
          borderRadius: isOpen ? '13px 13px 0 0' : 13,
        }}
        onClick={onToggle}
      >
        <span style={styles.sectionTitle}>
          <span>{icon}</span>
          {title}
        </span>

        <span style={styles.sectionRight}>
          <span style={styles.countBadge}>{count}</span>
          <span
            style={{
              ...styles.chevron,
              transform: isOpen ? 'rotate(180deg)' : 'none',
            }}
          >
            ⌄
          </span>
        </span>
      </button>

      {isGuideTarget && guideHintText && (
        <div style={styles.guideBanner}>
          <span>{guideHintText}</span>
          {onGuideNext && (
            <button type="button" style={styles.guideNextButton} onClick={onGuideNext}>
              次へ
            </button>
          )}
        </div>
      )}

      {isOpen && <div style={styles.sectionBody}>{children}</div>}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  // 誘導ガイドの案内帯。絶対配置の吹き出しだとドロワー内の縦の余白が乏しく、
  // セクション自身の中身(カレンダーのタブ等)や隣のセクションと重なってクリックの
  // 邪魔になってしまった(ユーザー指摘)。見出しの直下に通常のレイアウト要素として
  // 挿入し、中身を押し下げる形にすることで、何にも重ならないようにしている
  guideBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '8px 11px',
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.4,
  },
  guideNextButton: {
    flexShrink: 0,
    border: '1px solid rgba(255, 255, 255, 0.6)',
    borderRadius: 999,
    padding: '3px 12px',
    background: 'rgba(255, 255, 255, 0.16)',
    color: '#fff',
    fontSize: 10,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  section: {
    position: 'relative',
    border: '1px solid var(--border)',
    borderRadius: 14,
    background: 'var(--bg-elevated)',
    // overflow:hiddenは使わない。CSS Grid内でoverflow:hiddenを持つ子は自動最小サイズが0になり、
    // 高さの計算がずれて中身が押しつぶされる不具合が起きる（drawerBodyがdisplay:gridのため、
    // 中身が長いセクション（優先的タスク等）が見切れ、後続のセクションと詰まって見える原因に
    // なっていた。minHeight: 'max-content'で補おうとしたが不十分だった）。角丸のクリップは
    // ヘッダー側のborder-radiusを合わせることで実現し、overflow:hiddenそのものを排除する
    // （Combo-LABのAccordionSection.tsxと同じ対応）。
  },

  sectionHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    border: 0,
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    padding: '9px 11px',
    minHeight: 40,
    cursor: 'pointer',
  },

  sectionTitle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    fontWeight: 900,
  },

  sectionRight: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
  },

  countBadge: {
    minWidth: 21,
    height: 19,
    borderRadius: 999,
    display: 'inline-grid',
    placeItems: 'center',
    background: 'rgba(59, 130, 246, 0.18)',
    color: 'var(--accent-blue-text)',
    fontSize: 11,
    fontWeight: 900,
  },

  // 開閉で別の文字（⌃/⌄）に差し替えると字形の重心が微妙にずれて位置が上下して見えるため、
  // 同じ文字を180度回転させるだけにする
  chevron: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: 13,
    lineHeight: 1,
    transition: 'transform 0.15s',
  },

  sectionBody: {
    padding: 10,
  },
};
