import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useAppStore, todayDateKey } from '../store';
import type { Project } from '../types';
import { getStoredFileHandle, setStoredFileHandle } from '../utils/fileHandleStore';
import PatchNotesModal from './patchNotes/PatchNotesModal';
import { NicknameDisplay } from './NicknameDisplay';

const isFileSystemAccessSupported =
  typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';

function sanitizeFileNamePart(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]+/g, '_') || '無題のプロジェクト';
}

function projectExportFileName(project: Project): string {
  return `rooted-${sanitizeFileNamePart(project.title)}-${todayDateKey()}.json`;
}

function buildProjectExportPayload(project: Project) {
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    project,
  };
}

function extractProjectFromImportedJson(parsed: unknown): Partial<Project> | null {
  const candidate =
    parsed && typeof parsed === 'object' && 'project' in parsed
      ? (parsed as { project: unknown }).project
      : parsed;

  if (!candidate || typeof candidate !== 'object' || !('rootTask' in candidate)) {
    return null;
  }

  return candidate as Partial<Project>;
}

function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

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
}

export default function Header({
  appName = 'Rooted',
  onLogoClick,
  breadcrumbsSlot,
  title,
  subtitle,
  breadcrumbs,
  rightSlot,
}: HeaderProps) {
  const isPatchNotesModalOpen = useAppStore((state) => state.isPatchNotesModalOpen);
  const selectedPatchNoteDate = useAppStore((state) => state.selectedPatchNoteDate);
  const openPatchNotesModal = useAppStore((state) => state.openPatchNotesModal);
  const closePatchNotesModal = useAppStore((state) => state.closePatchNotesModal);

  const isRightPanelOpen = useAppStore((state) => state.rightPanel.isOpen);
  const toggleRightPanel = useAppStore((state) => state.toggleRightPanel);

  const projects = useAppStore((state) => state.projects);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const importProject = useAppStore((state) => state.importProject);
  const currentProject = projects.find((project) => project.id === currentProjectId) ?? null;

  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);
  const [backupMenuPosition, setBackupMenuPosition] = useState({ top: 0, right: 0 });
  const backupButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveFileHandlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());

  const handleBackupButtonClick = () => {
    const rect = backupButtonRef.current?.getBoundingClientRect();
    if (rect) {
      setBackupMenuPosition({
        top: rect.bottom + 6,
        right: window.innerWidth - rect.right,
      });
    }
    setIsBackupMenuOpen((open) => !open);
  };

  const handleExport = () => {
    if (!currentProject) return;
    downloadJson(projectExportFileName(currentProject), buildProjectExportPayload(currentProject));
    setIsBackupMenuOpen(false);
  };

  const handleImportButtonClick = () => {
    setIsBackupMenuOpen(false);
    fileInputRef.current?.click();
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    let projectData: Partial<Project> | null = null;
    try {
      projectData = extractProjectFromImportedJson(JSON.parse(await file.text()));
    } catch {
      projectData = null;
    }

    if (!projectData) {
      window.alert(
        'インポートに失敗しました。Rootedからエクスポートしたプロジェクトのjsonファイルを選択してください。',
      );
      return;
    }

    const isReplacing = projects.some((project) => project.id === projectData!.id);
    const projectTitle = projectData.title || '無題のプロジェクト';
    const confirmed = window.confirm(
      isReplacing
        ? `既存のプロジェクト「${projectTitle}」を、インポートしたファイルの内容で置き換えます。よろしいですか？`
        : `プロジェクト「${projectTitle}」を新規追加します。よろしいですか？`,
    );
    if (!confirmed) return;

    importProject(projectData);
  };

  const handleSaveOverwrite = async () => {
    setIsBackupMenuOpen(false);
    if (!currentProject) return;

    if (!isFileSystemAccessSupported || !window.showSaveFilePicker) {
      handleExport();
      return;
    }

    try {
      let handle =
        saveFileHandlesRef.current.get(currentProject.id) ??
        (await getStoredFileHandle(currentProject.id)) ??
        undefined;

      if (!handle) {
        handle = await window.showSaveFilePicker({
          suggestedName: projectExportFileName(currentProject),
          types: [
            { description: 'JSON', accept: { 'application/json': ['.json'] } },
          ],
        });
        await setStoredFileHandle(currentProject.id, handle);
      }

      saveFileHandlesRef.current.set(currentProject.id, handle);

      const permission = await handle.queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const requested = await handle.requestPermission({ mode: 'readwrite' });
        if (requested !== 'granted') {
          window.alert('ファイルへの書き込み権限が許可されませんでした。');
          return;
        }
      }

      const writable = await handle.createWritable();
      await writable.write(
        JSON.stringify(buildProjectExportPayload(currentProject), null, 2),
      );
      await writable.close();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      window.alert('上書き保存に失敗しました。');
    }
  };

  const breadcrumbItems =
    breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : title ? [title] : [];

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

            <div style={styles.backupMenuWrapper}>
              <button
                ref={backupButtonRef}
                type="button"
                style={styles.backupButton}
                onClick={handleBackupButtonClick}
                title="バックアップ（エクスポート／インポート）"
                aria-haspopup="menu"
                aria-expanded={isBackupMenuOpen}
              >
                <span>💾</span>
              </button>

              {isBackupMenuOpen && (
                <>
                  <div
                    style={styles.backupMenuOverlay}
                    onClick={() => setIsBackupMenuOpen(false)}
                  />

                  <div
                    style={{
                      ...styles.backupMenu,
                      top: backupMenuPosition.top,
                      right: backupMenuPosition.right,
                    }}
                    role="menu"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      style={{
                        ...styles.backupMenuItem,
                        ...(currentProject ? {} : styles.backupMenuItemDisabled),
                      }}
                      onClick={handleExport}
                      disabled={!currentProject}
                    >
                      <span>⬇️</span>
                      <span>エクスポート</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      style={styles.backupMenuItem}
                      onClick={handleImportButtonClick}
                    >
                      <span>⬆️</span>
                      <span>インポート</span>
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      style={{
                        ...styles.backupMenuItem,
                        ...(currentProject ? {} : styles.backupMenuItemDisabled),
                      }}
                      onClick={handleSaveOverwrite}
                      disabled={!currentProject}
                      title={
                        isFileSystemAccessSupported
                          ? undefined
                          : 'このブラウザは上書き保存に非対応のため、新規ダウンロードになります'
                      }
                    >
                      <span>💽</span>
                      <span>
                        上書き保存{isFileSystemAccessSupported ? '' : '（新規DL）'}
                      </span>
                    </button>
                  </div>
                </>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="application/json"
                style={styles.hiddenFileInput}
                onChange={handleImportFileChange}
              />
            </div>

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
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
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
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
  },
  brandIcon: {
    fontSize: 18,
    lineHeight: 1,
  },
  brandText: {
    color: 'var(--text-primary)',
    fontSize: 14,
    letterSpacing: '-0.02em',
  },
  divider: {
    flex: '0 0 auto',
    width: 1,
    height: 22,
    background: 'var(--border)',
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
  backupMenuWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  backupButton: {
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
    border: '1px solid rgba(45, 212, 191, 0.32)',
    background: 'rgba(20, 184, 166, 0.12)',
    color: '#5eead4',
    fontSize: 14,
    cursor: 'pointer',
  },
  backupMenuOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 59,
  },
  backupMenu: {
    position: 'fixed',
    zIndex: 60,
    minWidth: 176,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 4,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.35)',
  },
  backupMenuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 9px',
    borderRadius: 8,
    border: 0,
    background: 'transparent',
    color: 'var(--text-primary)',
    fontSize: 12,
    fontWeight: 700,
    textAlign: 'left',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  backupMenuItemDisabled: {
    color: 'var(--text-muted)',
    cursor: 'not-allowed',
  },
  hiddenFileInput: {
    display: 'none',
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
    borderTop: '1px solid var(--border)',
    boxSizing: 'border-box',
  },
  breadcrumbLabel: {
    flex: '0 0 auto',
    color: 'var(--text-muted)',
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
    color: 'var(--text-secondary)',
    fontSize: 12,
  },
  breadcrumbItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  },
  breadcrumbSeparator: {
    color: 'var(--text-muted)',
  },
  breadcrumbButton: {
    border: 0,
    background: 'transparent',
    color: 'var(--text-secondary)',
    padding: 0,
    cursor: 'pointer',
    fontSize: 12,
  },
  breadcrumbCurrent: {
    color: 'var(--text-primary)',
    fontWeight: 750,
  },
  subtitle: {
    color: '#60a5fa',
    fontSize: 12,
    fontWeight: 800,
  },
};
