import { useState } from 'react';
import { useAppStore } from '../store';
import { SAMPLE_PROJECT_ID } from '../data/guestSampleProject';
import { ProjectCard } from '../components/ProjectCard';
import { NewProjectModal } from '../components/NewProjectModal';
import Header from '../components/Header'; // ★ 追加：共通Headerコンポーネント
import HomeDrawerPanel from '../components/HomeDrawerPanel';

// 全ユーザー最初からサンプルプロジェクトが存在している仕様。ゲストはサンプル
// プロジェクトのみが表示され、追加・削除のUI自体を出さない（store側のガードではなく
// ここでの表示制御のみで制限する）
export function DashboardPage() {
  console.log('★ DashboardPageがレンダリングされました');
  const { projects, addProject, deleteProject, openProject, isGuest } = useAppStore();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const visibleProjects = isGuest
    ? projects.filter((project) => project.id === SAMPLE_PROJECT_ID)
    : projects;

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
                <div key={project.id} className="group">
                  <ProjectCard
                    project={project}
                    onOpen={() => openProject(project.id)}
                    onDelete={
                      isGuest
                        ? undefined
                        : () => {
                            if (confirm(`「${project.title}」を削除しますか？`)) {
                              deleteProject(project.id);
                            }
                          }
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
    </div>
  );
}
