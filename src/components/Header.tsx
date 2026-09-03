import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useAppStore, todayDateKey } from '../store';
import type { Project } from '../types';
import { getStoredFileHandle, setStoredFileHandle } from '../utils/fileHandleStore';
import { canEditBackupProjectsLocally } from '../utils/localEditAccess';
import { SAMPLE_PROJECT_ID } from '../data/guestSampleProject';
import PatchNotesModal from './patchNotes/PatchNotesModal';
import { ConfirmDialog } from './ConfirmDialog';
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
  const isGuest = useAppStore((state) => state.isGuest);

  const isPatchNotesModalOpen = useAppStore((state) => state.isPatchNotesModalOpen);
  const selectedPatchNoteDate = useAppStore((state) => state.selectedPatchNoteDate);
  const openPatchNotesModal = useAppStore((state) => state.openPatchNotesModal);
  const closePatchNotesModal = useAppStore((state) => state.closePatchNotesModal);

  const isRightPanelOpen = useAppStore((state) => state.rightPanel.isOpen);
  const toggleRightPanel = useAppStore((state) => state.toggleRightPanel);
  const isCopyModeActive = useAppStore((state) => state.isCopyModeActive);
  const endCopyMode = useAppStore((state) => state.endCopyMode);
  const priorityBulkActionType = useAppStore((state) => state.priorityBulkActionType);
  const endPriorityBulkAction = useAppStore((state) => state.endPriorityBulkAction);
  const isDueDateBulkActive = useAppStore((state) => state.isDueDateBulkActive);
  const dueDateBulkTargetDate = useAppStore((state) => state.dueDateBulkTargetDate);
  const endDueDateBulkAction = useAppStore((state) => state.endDueDateBulkAction);
  const isDemoEffectsEnabled = useAppStore((state) => state.isDemoEffectsEnabled);
  const toggleDemoEffects = useAppStore((state) => state.toggleDemoEffects);
  const resetSampleTutorial = useAppStore((state) => state.resetSampleTutorial);
  const drawerGuideStep = useAppStore((state) => state.drawerGuideStep);
  const showGuideClosingMessage = useAppStore((state) => state.showGuideClosingMessage);

  // パッチノート紹介バナー(下記styles.patchNotesIntroBanner)を、モーダル本体の
  // 少し上に来るよう実測して配置する。モーダルは内容量に応じて高さが変わり
  // 画面中央に配置されるため、固定pxではなく実際のDOM位置を測る
  const [patchNotesModalTop, setPatchNotesModalTop] = useState<number | null>(null);

  useEffect(() => {
    if (!isPatchNotesModalOpen) {
      setPatchNotesModalTop(null);
      return;
    }

    const updatePosition = () => {
      const titleEl = document.getElementById('patch-notes-title');
      const modalEl = titleEl?.closest('[role="dialog"]');
      const rect = modalEl?.getBoundingClientRect();
      if (rect) setPatchNotesModalTop(rect.top);
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [isPatchNotesModalOpen]);

  const projects = useAppStore((state) => state.projects);
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const importProject = useAppStore((state) => state.importProject);
  const currentProject = projects.find((project) => project.id === currentProjectId) ?? null;

  // サンプルプロジェクトはsrc/data/guestSampleProject.tsが供給元なので、
  // ここからの「プロジェクトへ保存」対象からは除外する
  const canSaveToProject =
    !isGuest &&
    canEditBackupProjectsLocally() &&
    Boolean(currentProject) &&
    currentProject?.id !== SAMPLE_PROJECT_ID;

  const [isResetTutorialConfirmOpen, setIsResetTutorialConfirmOpen] = useState(false);
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);
  const [importPending, setImportPending] = useState<{
    data: Partial<Project>;
    isReplacing: boolean;
    title: string;
  } | null>(null);
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
    setImportPending({ data: projectData, isReplacing, title: projectTitle });
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

  // 開発サーバーを経由して、プロジェクト内のsrc/data/backups/へ直接書き込む
  // （src/data/backupProjects.ts が起動時に自動で読み込む場所と同じ）。
  // 「上書き保存」（パソコン内の任意のファイル）とは別に、コミット対象のバックアップ
  // JSONをVSCode側にも反映させたい場合に使う（Combo-LABの「プロジェクトへ保存」と同じ考え方）
  const handleSaveToProjectBackup = async () => {
    setIsBackupMenuOpen(false);
    if (!currentProject) return;

    try {
      const response = await fetch('/__rooted-backup-api/project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildProjectExportPayload(currentProject)),
      });

      if (!response.ok) {
        const message = await response.text();
        window.alert(`プロジェクトへの保存に失敗しました。${message}`);
        return;
      }

      window.alert(`「${currentProject.title}」をプロジェクトへ保存しました。`);
    } catch {
      window.alert(
        'プロジェクトへの保存に失敗しました。npm run devで起動しているか確認してください。',
      );
    }
  };

  // コピー/優先タスク一括操作/期限一括登録のうち、ドロワーが閉じていて
  // ノード選択フェーズに入っているものがあれば、外部の⚡ボタンをその終了ボタンに
  // 差し替える（同時に複数が該当することはない）。期限一括登録は「まだ日付を
  // 選んでいない」フェーズではドロワーが開いたままなので対象外
  const activeBulkMode = isCopyModeActive
    ? { onEnd: endCopyMode, title: 'コピーを終了する', label: 'コピー終了' }
    : priorityBulkActionType === 'register'
      ? { onEnd: endPriorityBulkAction, title: '選択した内容で登録する', label: '登録終了' }
      : priorityBulkActionType === 'delete'
        ? { onEnd: endPriorityBulkAction, title: '選択した内容を削除する', label: '削除終了' }
        : isDueDateBulkActive && dueDateBulkTargetDate
          ? {
              onEnd: endDueDateBulkAction,
              title: '選択したノードへ期限を一括登録する',
              label: '期限登録終了',
            }
          : null;

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

            {isGuest && <span style={styles.guestBadge}>ゲストモード</span>}
          </div>

          <div style={styles.actions}>
            {rightSlot}

            <div style={{ position: 'relative' }}>
              {drawerGuideStep === 'openPatchNotes' && (
                <div className="tutorial-guide-bubble" style={styles.headerGuideBubble}>
                  パッチノートも覗いてみましょう
                  <div style={styles.headerGuideBubbleTriangle} />
                </div>
              )}

              <button
                type="button"
                className={
                  drawerGuideStep === 'openPatchNotes' ? 'tutorial-spotlight-ring' : undefined
                }
                style={styles.patchNotesButton}
                onClick={() => openPatchNotesModal()}
                title="パッチノートを開く"
              >
                <span>📜</span>
                <span style={styles.compactButtonText}>パッチノート</span>
              </button>
            </div>

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
                <span style={styles.compactButtonText}>バックアップ</span>
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

                    {canSaveToProject && (
                      <button
                        type="button"
                        role="menuitem"
                        style={styles.backupMenuItem}
                        onClick={handleSaveToProjectBackup}
                        title="開発サーバーを経由して、src/data/backups/ へ直接保存します（VSCode内のファイルが更新されます）"
                      >
                        <span>🗂️</span>
                        <span>プロジェクトへ保存</span>
                      </button>
                    )}
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

            {isGuest && (
              <button
                type="button"
                style={styles.tutorialResetButton}
                onClick={() => setIsResetTutorialConfirmOpen(true)}
                title="サンプルプロジェクトの「操作方法」ノードをリセットして、誘導ガイドを最初からやり直します"
              >
                <span>🔁</span>
                <span style={styles.compactButtonText}>チュートリアル</span>
              </button>
            )}

            <button
              type="button"
              style={{
                ...styles.demoEffectsButton,
                ...(isDemoEffectsEnabled ? styles.demoEffectsButtonActive : {}),
              }}
              onClick={toggleDemoEffects}
              title="デモ録画用の操作可視化演出（キー入力ポップ・クリック波紋）を切り替えます"
              aria-pressed={isDemoEffectsEnabled}
            >
              <span>🎬</span>
              <span style={styles.compactButtonText}>
                演出{isDemoEffectsEnabled ? 'ON' : 'OFF'}
              </span>
            </button>

            <div
              style={{
                position: 'relative',
                // 締めのメッセージ表示中は、そのオーバーレイ(zIndex:1000・暗転+ぼかし)
                // より前面に出してボタン本来の明るさ・光るリングをはっきり見せる
                // (ヴェールの下に埋もれて目立たなかったというユーザー指摘への対応)
                zIndex: showGuideClosingMessage ? 1001 : undefined,
              }}
            >
              {drawerGuideStep === 'openDrawer' && (
                <div className="tutorial-guide-bubble" style={styles.headerGuideBubble}>
                  サイドドロワーを開いてみましょう
                  <div style={styles.headerGuideBubbleTriangle} />
                </div>
              )}

              <button
                type="button"
                className={
                  drawerGuideStep === 'openDrawer' || showGuideClosingMessage
                    ? 'tutorial-spotlight-ring'
                    : undefined
                }
                style={{
                  ...styles.rightPanelButton,
                  ...(activeBulkMode || isRightPanelOpen ? styles.rightPanelButtonActive : {}),
                }}
                onClick={activeBulkMode ? activeBulkMode.onEnd : toggleRightPanel}
                title={activeBulkMode ? activeBulkMode.title : 'タスクパネルを開閉'}
                aria-pressed={activeBulkMode ? true : isRightPanelOpen}
              >
                <span>⚡</span>
                <span style={styles.compactButtonText}>
                  {activeBulkMode
                    ? activeBulkMode.label
                    : isRightPanelOpen
                      ? 'パネル閉じる'
                      : 'タスクパネル'}
                </span>
              </button>
            </div>
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

      {/* ── ゲスト向け誘導: パッチノートモーダルの少し上に紹介文を表示する。
          モーダル内の説明(パッチノート自身の見出し下)は控えめなため、開いた瞬間に
          気づいてもらえるようここでも強調表示する(ユーザー指摘を受けて追加) */}
      {isGuest && isPatchNotesModalOpen && patchNotesModalTop !== null && (
        <div
          style={{
            ...styles.patchNotesIntroBanner,
            top: patchNotesModalTop - 44,
          }}
        >
          制作者の日々の変更をここに記録しています。
        </div>
      )}

      {/* ── チュートリアルやり直しの確認 */}
      <ConfirmDialog
        isOpen={isResetTutorialConfirmOpen}
        title="チュートリアルをやり直す"
        message="サンプルプロジェクトの「操作方法」ノードで作った練習用のタスクをリセットして、誘導ガイドを最初からやり直します。よろしいですか？"
        confirmLabel="やり直す"
        onConfirm={() => {
          resetSampleTutorial();
          setIsResetTutorialConfirmOpen(false);
        }}
        onCancel={() => setIsResetTutorialConfirmOpen(false)}
      />

      {/* ── プロジェクトインポートの確認 */}
      <ConfirmDialog
        isOpen={importPending !== null}
        title="プロジェクトをインポート"
        message={
          importPending?.isReplacing
            ? `既存のプロジェクト「${importPending.title}」を、インポートしたファイルの内容で置き換えます。よろしいですか？`
            : `プロジェクト「${importPending?.title ?? ''}」を新規追加します。よろしいですか？`
        }
        confirmLabel="インポートする"
        onConfirm={() => {
          if (importPending) importProject(importPending.data);
          setImportPending(null);
        }}
        onCancel={() => setImportPending(null)}
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
    flexWrap: 'wrap',
    gap: 9,
    flex: '1 1 auto',
    // 横幅が足りない時、ニックネームがoverflow:hiddenで見えなくなるのではなく
    // ブランドアイコンの下へ折り返して表示されるようにする（flexWrapのみで対応、
    // JSでの幅判定は使わない）
    rowGap: 2,
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
  guestBadge: {
    flex: '0 0 auto',
    padding: '3px 8px',
    borderRadius: 999,
    border: '1px solid var(--accent-amber-border)',
    background: 'var(--accent-amber-bg)',
    color: 'var(--accent-amber-text)',
    fontSize: 11,
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },
  actions: {
    flex: '0 1 auto',
    minWidth: 0,
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  patchNotesButton: {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid var(--accent-amber-border)',
    background: 'var(--accent-amber-bg)',
    color: 'var(--accent-amber-text)',
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
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid var(--accent-teal-border)',
    background: 'var(--accent-teal-bg)',
    color: 'var(--accent-teal-text)',
    padding: '0 9px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
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
  // ゲスト向け誘導ガイド第2段の吹き出し。このボタン群は画面最上部のヘッダーにあり
  // 上に表示すると画面外に見切れて何も見えなくなるため、ボタンの下に出す
  // (右寄りのボタンを中心基準で配置すると画面端でちぎれる問題はNewTaskModal.tsxの
  // guideHintBubbleと同じ理由でボタンの右端に揃えて回避)
  headerGuideBubble: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 12,
    width: 'max-content',
    maxWidth: 260,
    padding: '7px 12px',
    borderRadius: 9,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 800,
    lineHeight: 1.4,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
    zIndex: 61,
  },
  headerGuideBubbleTriangle: {
    position: 'absolute',
    bottom: '100%',
    right: 16,
    width: 0,
    height: 0,
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderBottom: '5px solid var(--accent)',
  },
  // パッチノートモーダル(zIndex:1000)より前面に表示する紹介バナー。topは実測して
  // モーダル本体のすぐ上に来るようJS側で上書きする(Header.tsx側のuseEffect参照)
  patchNotesIntroBanner: {
    position: 'fixed',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1001,
    padding: '10px 18px',
    borderRadius: 11,
    background: 'var(--accent)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 900,
    lineHeight: 1.4,
    textAlign: 'center',
    boxShadow: '0 10px 28px rgba(0, 0, 0, 0.4)',
    whiteSpace: 'nowrap',
  },
  tutorialResetButton: {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid var(--accent-green-border)',
    background: 'var(--accent-green-bg)',
    color: 'var(--accent-green-text)',
    padding: '0 9px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  demoEffectsButton: {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    padding: '0 9px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  demoEffectsButtonActive: {
    borderColor: 'var(--accent-rose-border)',
    background: 'var(--accent-rose-bg)',
    color: 'var(--accent-rose-text)',
  },
  rightPanelButton: {
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    borderRadius: 11,
    border: '1px solid var(--accent-blue-border)',
    background: 'var(--accent-blue-bg)',
    color: 'var(--accent-blue-text)',
    padding: '0 9px',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  rightPanelButtonActive: {
    borderColor: 'var(--accent-rose-border)',
    background: 'var(--accent-rose-bg)',
    color: 'var(--accent-rose-text)',
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
