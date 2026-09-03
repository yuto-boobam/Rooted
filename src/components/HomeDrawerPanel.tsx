// src/components/HomeDrawerPanel.tsx
// ホーム画面（ダッシュボード）用のサイドドロワー。
// プロジェクトを横断して「期限が1週間以内（超過含む）」のタスクを、プロジェクトごとに開閉できる形で一覧表示する。

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppStore } from '../store';
import { SAMPLE_PROJECT_ID } from '../data/guestSampleProject';
import { flattenProjectTasks, formatCompactPath, type FlatTask } from '../utils/taskTree';
import { daysUntil } from '../utils/dueDate';
import { getDueUrgencyColors } from '../utils/dueDateColor';
import AccordionSection from './AccordionSection';
import DrawerLogoutFooter from './DrawerLogoutFooter';

const WEEK_DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

type UpcomingTask = { task: FlatTask; diffDays: number };

type ProjectGroup = {
  projectId: string;
  projectTitle: string;
  projectIcon: string;
  items: UpcomingTask[];
};

export default function HomeDrawerPanel() {
  const projects = useAppStore((state) => state.projects);
  const isGuest = useAppStore((state) => state.isGuest);
  const rightPanel = useAppStore((state) => state.rightPanel);
  const closeRightPanel = useAppStore((state) => state.closeRightPanel);
  const theme = useAppStore((state) => state.theme);
  const toggleTheme = useAppStore((state) => state.toggleTheme);
  const openProject = useAppStore((state) => state.openProject);
  const selectNode = useAppStore((state) => state.selectNode);

  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(
    () => new Set(),
  );

  const projectGroups = useMemo<ProjectGroup[]>(() => {
    const groups = projects
      .filter((project) => isGuest || project.id !== SAMPLE_PROJECT_ID)
      .map((project) => {
        const items = flattenProjectTasks(project)
          .filter((task) => !task.node.completed && task.node.dueDate)
          .map((task) => ({ task, diffDays: daysUntil(task.node.dueDate as string) }))
          .filter(({ diffDays }) => diffDays <= 7)
          .sort((a, b) => a.diffDays - b.diffDays);

        return {
          projectId: project.id,
          projectTitle: project.title,
          projectIcon: project.icon || '📁',
          items,
        };
      })
      .filter((group) => group.items.length > 0);

    return groups.sort((a, b) => a.items[0].diffDays - b.items[0].diffDays);
  }, [projects, isGuest]);

  const totalCount = projectGroups.reduce((sum, group) => sum + group.items.length, 0);

  const toggleGroup = (projectId: string) => {
    setCollapsedProjectIds((previous) => {
      const next = new Set(previous);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  const handleSelectTask = (task: FlatTask) => {
    openProject(task.projectId);
    selectNode(task.node.id);
  };

  return (
    <>
      {/* 背面をクリックしても閉じない（Combo-LABのSideDrawerPanelと同じく、開いたまま
          裏の画面を操作できるようにする。閉じるのはヘッダーの開閉ボタンのみ） */}
      <aside
        style={{
          ...styles.drawer,
          transform: rightPanel.isOpen ? 'translateX(0)' : 'translateX(105%)',
          pointerEvents: rightPanel.isOpen ? 'auto' : 'none',
        }}
        aria-hidden={!rightPanel.isOpen}
      >
        <header style={styles.drawerHeader}>
          <div style={styles.drawerTitleGroup}>
            <h2 style={styles.drawerTitle}>⏰ 期限が近いタスク</h2>

            <button
              type="button"
              style={styles.themeToggleButton}
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
              title={theme === 'dark' ? 'ライトモードに切り替え' : 'ダークモードに切り替え'}
            >
              {theme === 'dark' ? '🌙' : '☀️'}
            </button>
          </div>

          <button
            type="button"
            style={styles.closeButton}
            onClick={closeRightPanel}
            aria-label="パネルを閉じる"
          >
            ×
          </button>
        </header>

        <div className="drawer-scroll" style={styles.drawerBody}>
          <p style={styles.description}>
            すべてのプロジェクトから、期限まで1週間以内（期限超過も含む）の未完了タスクをプロジェクトごとに表示しています。
            {totalCount > 0 && ` 合計${totalCount}件。`}
          </p>

          {projectGroups.length === 0 ? (
            <div style={styles.emptyBox}>
              <div style={styles.emptyIcon}>🎉</div>
              <p style={styles.emptyTitle}>期限が近いタスクはありません</p>
              <p style={styles.emptyText}>
                1週間以内に期限のあるタスクができると、ここに一覧表示されます。
              </p>
            </div>
          ) : (
            projectGroups.map((group) => (
              <AccordionSection
                key={group.projectId}
                title={group.projectTitle}
                icon={group.projectIcon}
                count={group.items.length}
                isOpen={!collapsedProjectIds.has(group.projectId)}
                onToggle={() => toggleGroup(group.projectId)}
              >
                <div style={styles.taskList}>
                  {group.items.map(({ task, diffDays }) => {
                    const urgency = getDueUrgencyColors(diffDays);
                    const ancestorTitles = task.pathTitles.slice(0, -1);
                    const breadcrumb = formatCompactPath(ancestorTitles);
                    const breadcrumbFull = ancestorTitles.join(' / ');

                    return (
                      <button
                        key={task.node.id}
                        type="button"
                        style={{
                          ...styles.taskRow,
                          ...(urgency
                            ? { borderColor: urgency.accent, background: urgency.background }
                            : {}),
                        }}
                        onClick={() => handleSelectTask(task)}
                      >
                        <div style={styles.taskRowHeader}>
                          <div style={styles.taskTitle}>{task.node.title}</div>

                          <span
                            style={{
                              ...styles.dueBadge,
                              ...(urgency ? { color: urgency.accent } : {}),
                            }}
                          >
                            {formatDateWithWeekday(task.node.dueDate as string)}
                            {diffDays < 0 ? '（超過）' : diffDays === 0 ? '（本日）' : ''}
                          </span>
                        </div>

                        {breadcrumb && (
                          <div style={styles.pathText} title={breadcrumbFull}>
                            {breadcrumb}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </AccordionSection>
            ))
          )}
        </div>

        <DrawerLogoutFooter />
      </aside>
    </>
  );
}

function formatDateWithWeekday(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = WEEK_DAY_LABELS[date.getDay()];

  return `${Number(month)}/${Number(day)} (${weekday})`;
}

const styles: Record<string, CSSProperties> = {

  drawer: {
    position: 'fixed',
    top: 0,
    right: 0,
    zIndex: 700,
    width: 'min(420px, 94vw)',
    height: '100vh',
    background: 'linear-gradient(180deg, var(--bg-surface), var(--bg-base))',
    borderLeft: '1px solid var(--border)',
    color: 'var(--text-primary)',
    boxShadow: '-24px 0 70px rgba(0, 0, 0, 0.45)',
    transition: 'transform 220ms ease',
    display: 'grid',
    gridTemplateRows: 'auto minmax(0, 1fr) auto',
    overflow: 'hidden',
  },

  drawerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    minHeight: 50,
    borderBottom: '1px solid var(--border)',
  },

  drawerTitleGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },

  drawerTitle: {
    margin: 0,
    color: 'var(--text-primary)',
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.2,
  },

  themeToggleButton: {
    flex: '0 0 auto',
    width: 28,
    height: 28,
    borderRadius: 9,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closeButton: {
    flex: '0 0 auto',
    width: 30,
    height: 30,
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: 1,
  },

  drawerBody: {
    minHeight: 0,
    minWidth: 0,
    overflowY: 'auto',
    // overflow-yをauto等にすると、overflow-xを明示しない限りブラウザはそちらも
    // auto扱いにする（CSS仕様上の既定挙動）。中の要素がわずかでも幅をはみ出すと
    // ドロワー全体が横スクロール可能になり、他のセクションまで巻き込まれてずれて
    // 見える不具合になるため、横方向のはみ出しは常に隠す
    overflowX: 'hidden',
    overscrollBehavior: 'contain',
    padding: 12,
    display: 'grid',
    alignContent: 'start',
    gap: 10,
  },

  description: {
    margin: 0,
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.6,
  },

  taskList: {
    display: 'grid',
    gap: 8,
  },

  taskRow: {
    display: 'grid',
    gap: 4,
    textAlign: 'left',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 10,
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    font: 'inherit',
  },

  taskRowHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },

  dueBadge: {
    flex: '0 0 auto',
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: 'nowrap',
  },

  taskTitle: {
    minWidth: 0,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 850,
    lineHeight: 1.4,
    overflowWrap: 'anywhere',
  },

  pathText: {
    color: 'var(--text-muted)',
    fontSize: 11,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  emptyBox: {
    padding: 20,
    textAlign: 'center',
    border: '1px dashed var(--border)',
    borderRadius: 16,
    background: 'var(--bg-elevated)',
  },

  emptyIcon: {
    fontSize: 34,
  },

  emptyTitle: {
    margin: '10px 0 0',
    color: 'var(--text-primary)',
    fontWeight: 900,
  },

  emptyText: {
    margin: '8px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.6,
  },
};
