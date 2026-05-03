import { useRef } from 'react';
import { useAppStore } from '../store';
import { Breadcrumb } from '../components/Breadcrumb';
import { TaskNodeCard } from '../components/TaskNodeCard';
import type { TaskNode } from '../types';

/** ノードIDからノードを再帰的に検索する */
function findNode(root: TaskNode, id: string): TaskNode | null {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

export function TreePage() {
  const {
    projects,
    currentProjectId,
    selectedPath,
    goToDashboard,
    selectNode,
    navigateToPath,
    addChildNode,
    addSiblingNode,
    deleteNode,
    toggleComplete,
    updateNodeTitle,
    updateNodeMemo,
    reorderNodes,
    refreshProgress,
  } = useAppStore();

  const project = projects.find((p) => p.id === currentProjectId);
  if (!project) return null;

  const root = project.rootTask;
  const accentColor = project.color;

  // ── ドラッグ&ドロップの状態（UIのみなのでuseRefで管理）
  const dragFrom = useRef<number>(-1);
  const dragTo = useRef<number>(-1);

  // ── パンくずリスト用：selectedPath の各IDに対してノードを取得
  const breadcrumbItems = selectedPath
    .map((id) => {
      const node = findNode(root, id);
      return node ? { id: node.id, title: node.title } : null;
    })
    .filter(Boolean) as { id: string; title: string }[];

  // ── 列（カラム）の構築
  // selectedPath = [rootId, A_id, B_id] の場合:
  //   column[0] = root の children（rootIdの子）
  //   column[1] = A の children（A_idの子）
  //   以降は最後に選択したノードまで
  const columns: { parentId: string; nodes: TaskNode[]; depth: number }[] = [];
  for (let i = 0; i < selectedPath.length; i++) {
    const nodeId = selectedPath[i];
    const node = findNode(root, nodeId);
    if (node && node.children.length > 0) {
      columns.push({ parentId: node.id, nodes: node.children, depth: i });
    }
  }

  const lastSelectedId = selectedPath[selectedPath.length - 1];
  const lastNode = findNode(root, lastSelectedId);

  // ── ノード選択時：selectedPath を nodeId までに更新
  const handleSelectNode = (nodeId: string) => {
    selectNode(nodeId);
  };

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ── ヘッダー */}
      <header
        className="flex items-center gap-4 px-6 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {/* ロゴ（クリックでダッシュボードへ） */}
        <button
          id="back-to-dashboard"
          className="flex items-center gap-2 btn-ghost"
          onClick={goToDashboard}
          title="プロジェクト一覧へ戻る"
        >
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center text-sm"
            style={{ background: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}
          >
            🌱
          </div>
          <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
            Rooted
          </span>
        </button>

        {/* 区切り */}
        <span style={{ color: 'var(--text-muted)' }}>›</span>

        {/* プロジェクト名 */}
        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {project.title}
        </span>

        {/* パンくずリスト */}
        {breadcrumbItems.length > 0 && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>›</span>
            <Breadcrumb
              items={breadcrumbItems}
              onNavigate={(path) => navigateToPath(path)}
            />
          </>
        )}

        {/* スペーサー */}
        <div className="flex-1" />

        {/* 進捗更新ボタン */}
        <button
          id="refresh-progress-tree"
          className="btn-ghost"
          onClick={refreshProgress}
          title="全ノードの進捗率を再計算します"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          進捗を更新
        </button>
      </header>

      {/* ── 操作ガイド */}
      <div
        className="flex items-center gap-4 px-6 py-1.5 text-xs flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}
      >
        <span>💡 ヒント:</span>
        <span><kbd style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>Enter</kbd> 子タスク追加</span>
        <span><kbd style={{ background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>Tab</kbd> 兄弟タスク追加</span>
        <span>ダブルクリックでタイトル・メモを編集 / ドラッグで並び替え</span>
      </div>

      {/* ── ツリービュー本体（横スクロール） */}
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden">

        {/* 左端：ルートノードカード */}
        <div className="flex-shrink-0 p-4 flex items-start" style={{ width: 220 }}>
          <div className="w-full">
            <TaskNodeCard
              node={root}
              isSelected={selectedPath[selectedPath.length - 1] === root.id}
              isRoot
              accentColor={accentColor}
              onClick={() => handleSelectNode(root.id)}
              onToggleComplete={() => toggleComplete(project.id, root.id)}
              onUpdateTitle={(t) => updateNodeTitle(project.id, root.id, t)}
              onUpdateMemo={(m) => updateNodeMemo(project.id, root.id, m)}
              onAddChild={() => {
                const newId = addChildNode(project.id, root.id);
                selectNode(newId);
              }}
              onAddSibling={() => {}} // rootには兄弟なし
              onDelete={() => {}}    // rootは削除不可
              dragIndex={0}
              onDragStart={() => {}}
              onDragOver={() => {}}
              onDrop={() => {}}
            />
          </div>
        </div>

        {/* 列区切りの矢印 */}
        {columns.length > 0 && (
          <div className="flex-shrink-0 flex items-start pt-6">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        )}

        {/* 各列 */}
        {columns.map((column, colIndex) => {
          const isLastColumn = colIndex === columns.length - 1;

          return (
            <div key={column.parentId} className="flex gap-2">
              {/* ノード列 */}
              <div
                className="flex-shrink-0 overflow-y-auto py-4 px-2 flex flex-col gap-2"
                style={{ width: 240, maxHeight: '100%' }}
              >
                {column.nodes.map((node, nodeIndex) => {
                  const isSelected =
                    selectedPath.includes(node.id) &&
                    selectedPath.indexOf(node.id) === selectedPath.length - 1 - (columns.length - 1 - colIndex);

                  return (
                    <TaskNodeCard
                      key={node.id}
                      node={node}
                      isSelected={selectedPath.includes(node.id)}
                      accentColor={accentColor}
                      onClick={() => handleSelectNode(node.id)}
                      onToggleComplete={() => toggleComplete(project.id, node.id)}
                      onUpdateTitle={(t) => updateNodeTitle(project.id, node.id, t)}
                      onUpdateMemo={(m) => updateNodeMemo(project.id, node.id, m)}
                      onAddChild={() => {
                        const newId = addChildNode(project.id, node.id);
                        selectNode(newId);
                      }}
                      onAddSibling={() => {
                        const newId = addSiblingNode(project.id, node.id);
                        selectNode(newId);
                      }}
                      onDelete={() => {
                        if (confirm(`「${node.title}」を削除しますか？\n子タスクもすべて削除されます。`)) {
                          deleteNode(project.id, node.id);
                        }
                      }}
                      dragIndex={nodeIndex}
                      onDragStart={(i) => { dragFrom.current = i; }}
                      onDragOver={(i) => { dragTo.current = i; }}
                      onDrop={() => {
                        if (dragFrom.current !== -1 && dragTo.current !== -1 && dragFrom.current !== dragTo.current) {
                          reorderNodes(project.id, column.parentId, dragFrom.current, dragTo.current);
                        }
                        dragFrom.current = -1;
                        dragTo.current = -1;
                      }}
                    />
                  );
                })}

                {/* 新しいタスクを追加ボタン */}
                <button
                  className="btn-ghost w-full text-xs justify-start gap-1.5 mt-1"
                  onClick={() => {
                    const newId = addChildNode(project.id, column.parentId);
                    selectNode(newId);
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  新しいタスクを追加
                </button>
              </div>

              {/* 列間の矢印（最後の列以外） */}
              {!isLastColumn && (
                <div className="flex-shrink-0 flex items-start pt-6">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--text-muted)' }}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              )}
            </div>
          );
        })}

        {/* 末端：子タスクなしの場合の追加エリア */}
        {lastNode && lastNode.children.length === 0 && (
          <div className="flex-shrink-0 flex items-start pt-4 px-4">
            <div
              className="flex flex-col items-center justify-center gap-2 rounded-xl p-4 cursor-pointer transition-all"
              style={{
                width: 180,
                border: '1.5px dashed var(--border)',
                color: 'var(--text-muted)',
                minHeight: 100,
              }}
              onClick={() => {
                const newId = addChildNode(project.id, lastSelectedId);
                selectNode(newId);
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = accentColor;
                el.style.color = accentColor;
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'var(--border)';
                el.style.color = 'var(--text-muted)';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="text-xs text-center">子タスクを追加<br/>（Enter）</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
