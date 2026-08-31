import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../store';
import type { Project } from '../types';
import { SAMPLE_PROJECT_ID } from '../data/guestSampleProject';
import { ProjectCard } from '../components/ProjectCard';
import { NewProjectModal } from '../components/NewProjectModal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import Header from '../components/Header'; // ★ 追加：共通Headerコンポーネント
import HomeDrawerPanel from '../components/HomeDrawerPanel';
import { hasGuestSeenTutorial, markGuestTutorialSeen } from '../utils/guestTutorialSession';

// 全ユーザー最初からサンプルプロジェクトが存在している仕様。ゲストはサンプル
// プロジェクトのみが表示され、追加・削除のUI自体を出さない（store側のガードではなく
// ここでの表示制御のみで制限する）
export function DashboardPage() {
  console.log('★ DashboardPageがレンダリングされました');
  const { projects, addProject, deleteProject, openProject, isGuest } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectPendingDelete, setProjectPendingDelete] = useState<Project | null>(null);

  const visibleProjects = isGuest
    ? projects.filter((project) => project.id === SAMPLE_PROJECT_ID)
    : projects;

  const sampleProject = visibleProjects.find((project) => project.id === SAMPLE_PROJECT_ID);

  // ゲストがログインして最初にこの画面へ来た時、サンプルプロジェクトを開くよう誘導を
  // 必須にする(Combo-LABの「ゲスト初回のスポットライト誘導」と同じ考え方。詳細はプロジェクトの
  // 記憶参照)。一度でも開けばこのタブを閉じるまで出さない(sessionStorage、guestTutorialSession.ts)
  const showTutorialSpotlight = isGuest && Boolean(sampleProject) && !hasGuestSeenTutorial();

  const sampleCardRef = useRef<HTMLDivElement>(null);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!showTutorialSpotlight) {
      setSpotlightRect(null);
      return;
    }
    const updateRect = () => {
      const el = sampleCardRef.current;
      if (el) setSpotlightRect(el.getBoundingClientRect());
    };
    updateRect();
    window.addEventListener('resize', updateRect);
    return () => window.removeEventListener('resize', updateRect);
  }, [showTutorialSpotlight]);

  const handleOpenSample = () => {
    if (isGuest) markGuestTutorialSeen();
    openProject(SAMPLE_PROJECT_ID);
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ── 共通ヘッダー（パッチノートボタン＆モーダル内包） */}
      <Header
        rightSlot={
          isGuest ? undefined : (
            <button
              id="new-project-btn"
              className="btn-primary"
              onClick={() => setIsModalOpen(true)}
              style={{
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 11,
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              新しいプロジェクト
            </button>
          )
        }
      />

      {/* ── メインコンテンツ */}
      <main className="flex-1 overflow-y-auto px-10 py-8">
        {/* プロジェクトが0件のときの空状態（ゲストは常にサンプルプロジェクトが存在するため到達しない） */}
        {visibleProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 animate-fadeIn">
            <div className="text-6xl">🌱</div>
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              最初のプロジェクトを作成しましょう
            </h2>
            <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-secondary)' }}>
              「新しいプロジェクト」ボタンをクリックして、タスクツリーを始めましょう。
            </p>
            <button
              className="btn-primary mt-2"
              onClick={() => setIsModalOpen(true)}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              新しいプロジェクト
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-sm font-medium mb-5" style={{ color: 'var(--text-muted)' }}>
              プロジェクト一覧 — {visibleProjects.length} 件
            </h1>

            {/* プロジェクトグリッド */}
            <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
              {visibleProjects.map((project) => (
                <div
                  key={project.id}
                  className="group"
                  ref={project.id === SAMPLE_PROJECT_ID ? sampleCardRef : undefined}
                  // スポットライト表示中は実カードを複製版が覆う形になるため、実カード側は
                  // 誤クリックを避けるためいったん非表示にする(レイアウト上の場所は保持する)
                  style={showTutorialSpotlight && project.id === SAMPLE_PROJECT_ID ? { visibility: 'hidden' } : undefined}
                >
                  <ProjectCard
                    project={project}
                    onOpen={project.id === SAMPLE_PROJECT_ID ? handleOpenSample : () => openProject(project.id)}
                    onDelete={
                      isGuest ? undefined : () => setProjectPendingDelete(project)
                    }
                  />
                </div>
              ))}

              {/* 新規作成カード */}
              {!isGuest && (
                <button
                  id="add-project-card"
                  className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all duration-200"
                  style={{
                    border: '1.5px dashed var(--border)',
                    background: 'transparent',
                    minHeight: 180,
                    color: 'var(--text-muted)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                    (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
                  }}
                  onClick={() => setIsModalOpen(true)}
                >
                  <span className="text-2xl">＋</span>
                  <span className="text-sm font-medium">プロジェクトを追加</span>
                </button>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── 新規プロジェクトモーダル（ゲストは開けない） */}
      {isModalOpen && !isGuest && (
        <NewProjectModal
          onConfirm={(title, description) => addProject(title, description)}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* ── サイドドロワー（期限が近いタスクの横断一覧） */}
      <HomeDrawerPanel />

      {/* ── プロジェクト削除の確認 */}
      <ConfirmDialog
        isOpen={projectPendingDelete !== null}
        title="プロジェクトを削除"
        message={`「${projectPendingDelete?.title ?? ''}」を削除しますか？`}
        confirmLabel="削除する"
        onConfirm={() => {
          if (projectPendingDelete) deleteProject(projectPendingDelete.id);
          setProjectPendingDelete(null);
        }}
        onCancel={() => setProjectPendingDelete(null)}
      />

      {/* ── ゲスト初回、サンプルプロジェクトを開くよう誘導するスポットライト演出。
          このページの外枠・mainは共にoverflow:hidden/autoで、暗くする側のbox-shadowの
          拡散がそのままだとクリップされる(Combo-LABのサイドドロワーで踏んだのと同じ問題、
          詳細はプロジェクトの記憶参照)ため、document.bodyへcreatePortalして回避する。
          実カードの位置・サイズをgetBoundingClientRectで測り、同じ場所に複製カードを
          浮かせて表示することで「ここを押せばいい」がひと目でわかるようにしている */}
      {showTutorialSpotlight &&
        spotlightRect &&
        sampleProject &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(0, 0, 0, 0.72)',
            }}
          >
            <div
              className="tutorial-spotlight-ring"
              style={{
                position: 'fixed',
                top: spotlightRect.top,
                left: spotlightRect.left,
                width: spotlightRect.width,
                height: spotlightRect.height,
                borderRadius: 'var(--radius-md)',
                zIndex: 201,
              }}
            >
              <div
                className="tutorial-guide-bubble"
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  marginBottom: 14,
                  width: 220,
                  padding: '8px 12px',
                  borderRadius: 10,
                  background: 'var(--accent)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.5,
                  textAlign: 'center',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
                }}
              >
                まずはここから開いてみましょう
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 0,
                    height: 0,
                    borderLeft: '6px solid transparent',
                    borderRight: '6px solid transparent',
                    borderTop: '6px solid var(--accent)',
                  }}
                />
              </div>
              <ProjectCard project={sampleProject} onOpen={handleOpenSample} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
