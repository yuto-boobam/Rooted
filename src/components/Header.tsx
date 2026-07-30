import type { CSSProperties, ReactNode } from 'react';
import { useAppStore } from '../store';
import PatchNotesModal from './patchNotes/PatchNotesModal';

export type HeaderBreadcrumbItem =
  | string
  | {
      label: string;
      onClick?: () => void;
    };

interface HeaderProps {
  appName?: string;
  nickname?: string | null;
  title?: string;
  subtitle?: string;
  breadcrumbs?: HeaderBreadcrumbItem[];
  rightSlot?: ReactNode;
  onNicknameClick?: () => void;
  onRefreshProgress?: () => void;
  showRefreshButton?: boolean;
}

export default function Header({
  appName = 'Rooted',
  nickname = 'ニックネーム未設定',
  title,
  subtitle,
  breadcrumbs,
  rightSlot,
  onNicknameClick,
  onRefreshProgress,
  showRefreshButton,
}: HeaderProps) {
  const isPatchNotesModalOpen = useAppStore((state) => state.isPatchNotesModalOpen);
  const selectedPatchNoteDate = useAppStore((state) => state.selectedPatchNoteDate);
  const openPatchNotesModal = useAppStore((state) => state.openPatchNotesModal);
  const closePatchNotesModal = useAppStore((state) => state.closePatchNotesModal);

  const nicknameLabel = nickname?.trim() || 'ニックネーム未設定';
  const breadcrumbItems = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : title ? [title] : [];
  const shouldShowRefreshButton = showRefreshButton ?? Boolean(onRefreshProgress);

  return (
    <>
      <header style={styles.header}>
        <div style={styles.leftArea}>
          <div style={styles.brand} title={appName}>
            <span style={styles.brandIcon}>🌱</span>
            <strong style={styles.brandText}>{appName}</strong>
          </div>

          <div style={styles.divider} />

          <button
            type="button"
            style={{
              ...styles.nicknameButton,
              cursor: onNicknameClick ? 'pointer' : 'default',
            }}
            onClick={onNicknameClick}
            title={nicknameLabel}
          >
            <span style={styles.nicknameText}>{nicknameLabel}</span>
            {onNicknameClick && <span style={styles.editIcon}>✎</span>}
          </button>

          {breadcrumbItems.length > 0 && (
            <nav style={styles.breadcrumbs} aria-label="現在位置">
              {breadcrumbItems.map((item, index) => {
                const label = typeof item === 'string' ? item : item.label;
                const onClick = typeof item === 'string' ? undefined : item.onClick;

                return (
                  <span key={`${label}-${index}`} style={styles.breadcrumbItem}>
                    {index > 0 && <span style={styles.breadcrumbSeparator}>›</span>}

                    {onClick ? (
                      <button type="button" style={styles.breadcrumbButton} onClick={onClick}>
                        {label}
                      </button>
                    ) : (
                      <span style={styles.breadcrumbCurrent}>{label}</span>
                    )}
                  </span>
                );
              })}
            </nav>
          )}

          {subtitle && <span style={styles.subtitle}>{subtitle}</span>}
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
        </div>
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
    height: 52,
    minHeight: 52,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '0 10px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
    background: 'rgba(3, 7, 18, 0.92)',
    color: '#e5e7eb',
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
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    height: 34,
    padding: '0 9px',
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'rgba(15, 23, 42, 0.72)',
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
  nicknameButton: {
    flex: '0 1 auto',
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    maxWidth: 150,
    border: 0,
    background: 'transparent',
    color: '#94a3b8',
    padding: '4px 2px',
    fontSize: 12,
  },
  nicknameText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  editIcon: {
    color: '#64748b',
    fontSize: 12,
  },
  breadcrumbs: {
    minWidth: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
    color: '#94a3b8',
    fontSize: 12,
  },
  breadcrumbItem: {
    minWidth: 0,
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
    minWidth: 0,
    color: '#e5e7eb',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontWeight: 750,
  },
  subtitle: {
    flex: '0 1 auto',
    minWidth: 0,
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 800,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    flex: '0 0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  patchNotesButton: {
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid rgba(250, 204, 21, 0.32)',
    background: 'rgba(250, 204, 21, 0.1)',
    color: '#fde68a',
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  refreshButton: {
    height: 34,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(15, 23, 42, 0.85)',
    color: '#e5e7eb',
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  compactButtonText: {
    lineHeight: 1,
  },
};
