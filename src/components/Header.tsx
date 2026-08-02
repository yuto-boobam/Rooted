import type { CSSProperties, ReactNode } from 'react';
import { useAppStore } from '../store';
import PatchNotesModal from './patchNotes/PatchNotesModal';
import { NicknameDisplay } from './NicknameDisplay';

export type HeaderBreadcrumbItem =
  | string
  | {
    label: string;
    onClick?: () => void;
  };

interface HeaderProps {
  appName?: string;
  onLogoClick?: () => void;
  breadcrumbsSlot?: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: HeaderBreadcrumbItem[];
  rightSlot?: ReactNode;
  onRefreshProgress?: () => void;
  showRefreshButton?: boolean;
}

export default function Header({
  appName = 'Rooted',
  onLogoClick,
  breadcrumbsSlot,
  title,
  subtitle,
  breadcrumbs,
  rightSlot,
  onRefreshProgress,
  showRefreshButton,
}: HeaderProps) {
  const isPatchNotesModalOpen = useAppStore((state) => state.isPatchNotesModalOpen);
  const selectedPatchNoteDate = useAppStore((state) => state.selectedPatchNoteDate);
  const openPatchNotesModal = useAppStore((state) => state.openPatchNotesModal);
  const closePatchNotesModal = useAppStore((state) => state.closePatchNotesModal);

  const isRightPanelOpen = useAppStore((state) => state.rightPanel.isOpen);
  const toggleRightPanel = useAppStore((state) => state.toggleRightPanel);

  const breadcrumbItems =
    breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : title ? [title] : [];

  const shouldShowRefreshButton = showRefreshButton ?? Boolean(onRefreshProgress);

  const hasSecondRow =
    Boolean(breadcrumbsSlot) || breadcrumbItems.length > 0 || Boolean(subtitle);

  return (
    <>
      <header style={styles.header}>
        <div style={styles.topRow}>
          <div style={styles.leftArea}>
            {onLogoClick ? (
              <button
                type="button"
                onClick={onLogoClick}
                style={{ ...styles.brand, cursor: 'pointer' }}
                title="プロジェクト一覧へ戻る"
              >
                <span style={styles.brandIcon}>🌱</span>
                <strong style={styles.brandText}>{appName}</strong>
              </button>
            ) : (
              <div style={styles.brand} title={appName}>
                <span style={styles.brandIcon}>🌱</span>
                <strong style={styles.brandText}>{appName}</strong>
              </div>
            )}

            <div style={styles.divider} />

            <NicknameDisplay showDivider={false} />
          </div>

          <div style={styles.actions}>
            {rightSlot}

            <button
              type="button"
              style={styles.patchNotesButton}
              onClick={() => openPatchNotesModal()}
              title="パッチノートを開く"
            >
              <span>📜</span>
              <span style={styles.compactButtonText}>パッチノート</span>
            </button>

            {shouldShowRefreshButton && (
              <button
                type="button"
                style={{
                  ...styles.refreshButton,
                  opacity: onRefreshProgress ? 1 : 0.5,
                  cursor: onRefreshProgress ? 'pointer' : 'not-allowed',
                }}
                onClick={onRefreshProgress}
                disabled={!onRefreshProgress}
                title="進捗を更新"
              >
                <span>↻</span>
                <span style={styles.compactButtonText}>進捗を更新</span>
              </button>
            )}

            <button
              type="button"
              style={{
                ...styles.rightPanelButton,
                ...(isRightPanelOpen ? styles.rightPanelButtonActive : {}),
              }}
              onClick={toggleRightPanel}
              title="右側パネルを開閉"
              aria-pressed={isRightPanelOpen}
            >
              <span>⚡</span>
              <span style={styles.compactButtonText}>
                {isRightPanelOpen ? 'パネル閉じる' : '新パネル'}
              </span>
            </button>
          </div>
        </div>

        {hasSecondRow && (
          <div style={styles.secondRow}>
            <div style={styles.breadcrumbLabel}>現在位置</div>

            <div style={styles.breadcrumbContent}>
              {breadcrumbsSlot ? (
                breadcrumbsSlot
              ) : (
                <nav style={styles.breadcrumbs} aria-label="現在位置">
                  {breadcrumbItems.map((item, index) => {
                    const label = typeof item === 'string' ? item : item.label;
                    const onClick = typeof item === 'string' ? undefined : item.onClick;

                    return (
                      <span key={`${label}-${index}`} style={styles.breadcrumbItem}>
                        {index > 0 && <span style={styles.breadcrumbSeparator}>›</span>}

                        {onClick ? (
                          <button
                            type="button"
                            style={styles.breadcrumbButton}
                            onClick={onClick}
                          >
                            {label}
                          </button>
                        ) : (
                          <span style={styles.breadcrumbCurrent}>{label}</span>
                        )}
                      </span>
                    );
                  })}

                  {subtitle && <span style={styles.subtitle}>{subtitle}</span>}
                </nav>
              )}
            </div>
          </div>
        )}
      </header>

      <PatchNotesModal
        isOpen={isPatchNotesModalOpen}
        onClose={closePatchNotesModal}
        initialSelectedDate={selectedPatchNoteDate ?? undefined}
      />
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  header: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
    background: 'rgba(3, 7, 18, 0.94)',
    color: '#e5e7eb',
    boxSizing: 'border-box',
  },
  topRow: {
    minHeight: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '7px 10px',
    boxSizing: 'border-box',
  },
  leftArea: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    flex: '1 1 auto',
    overflow: 'hidden',
  },
  brand: {
    flex: '0 0 auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    height: 34,
    padding: '0 9px',
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'rgba(15, 23, 42, 0.72)',
    color: '#f8fafc',
  },
  brandIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  brandText: {
    color: '#f8fafc',
    fontSize: 14,
    letterSpacing: '-0.02em',
  },
  divider: {
    flex: '0 0 auto',
    width: 1,
    height: 22,
    background: 'rgba(148, 163, 184, 0.15)',
  },
  actions: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
    overflowX: 'auto',
    maxWidth: '72vw',
  },
  patchNotesButton: {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid rgba(250, 204, 21, 0.32)',
    background: 'rgba(250, 204, 21, 0.1)',
    color: '#fde68a',
    padding: '0 9px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  refreshButton: {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#e5e7eb',
    padding: '0 9px',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  rightPanelButton: {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid rgba(96, 165, 250, 0.32)',
    background: 'rgba(37, 99, 235, 0.12)',
    color: '#bfdbfe',
    padding: '0 9px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  rightPanelButtonActive: {
    borderColor: 'rgba(251, 113, 133, 0.48)',
    background: 'rgba(251, 113, 133, 0.16)',
    color: '#fecdd3',
  },
  compactButtonText: {
    lineHeight: 1,
  },
  secondRow: {
    minHeight: 34,
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '5px 12px 8px',
    borderTop: '1px solid rgba(148, 163, 184, 0.08)',
    boxSizing: 'border-box',
  },
  breadcrumbLabel: {
    flex: '0 0 auto',
    color: '#64748b',
    fontSize: 11,
    fontWeight: 800,
  },
  breadcrumbContent: {
    minWidth: 0,
    flex: '1 1 auto',
    overflowX: 'auto',
    overflowY: 'hidden',
    whiteSpace: 'nowrap',
    paddingBottom: 1,
  },
  breadcrumbs: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#94a3b8',
    fontSize: 12,
  },
  breadcrumbItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbSeparator: {
    color: '#475569',
  },
  breadcrumbButton: {
    border: 0,
    background: 'transparent',
    color: '#94a3b8',
    padding: 0,
    cursor: 'pointer',
    fontSize: 12,
  },
  breadcrumbCurrent: {
    color: '#e5e7eb',
    fontWeight: 750,
  },
  subtitle: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 800,
  },
};
