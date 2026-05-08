import { useRef, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { Breadcrumb } from '../components/Breadcrumb';
import { TaskNodeCard } from '../components/TaskNodeCard';
import { NewTaskModal } from '../components/NewTaskModal';
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

// ── タスク追加モーダルの状態型
type ModalState =
  | { open: false }
  | { open: true; mode: 'child' | 'sibling'; targetId: string };

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
  const dragTo   = useRef<number>(-1);

  // ── タスク追加モーダルの状態
  const [modal, setModal] = useState<ModalState>({ open: false });

  // モーダルを開くヘルパー
  const openChildModal   = useCallback((targetId: string) => setModal({ open: true, mode: 'child',   targetId }), []);
  const openSiblingModal = useCallback((targetId: string) => setModal({ open: true, mode: 'sibling', targetId }), []);
  const closeModal       = useCallback(() => setModal({ open: false }), []);

  // モーダル確定ハンドラ
  const handleModalConfirm = useCallback((title: string, memo: string) => {
    if (!modal.open) return;
    if (modal.mode === 'child') {
      const newId = addChildNode(project.id, modal.targetId, title, memo);
      selectNode(newId);
    } else {
      const newId = addSiblingNode(project.id, modal.targetId, title, memo);
      selectNode(newId);
    }
  }, [modal, project.id, addChildNode, addSiblingNode, selectNode]);

  // ── グローバルキーボードショートカット（モーダルが閉じているときだけ有効）
  const lastSelectedId = selectedPath[selectedPath.length - 1];

  useEffect(() => {
    if (modal.open) return; // モーダル表示中はスキップ

    const handler = (e: KeyboardEvent) => {
      // テキスト入力中（textarea / input）はスキップ
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      if (!lastSelectedId) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        openChildModal(lastSelectedId);
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        // ルートノードには兄弟を追加しない
        if (lastSelectedId === root.id) return;
        openSiblingModal(lastSelectedId);
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [modal.open, lastSelectedId, root.id, openChildModal, openSiblingModal]);

  // ── パンくずリスト用
  const breadcrumbItems = selectedPath
    .map((id) => {
      const node = findNode(root, id);
      return node ? { id: node.id, title: node.title } : null;
    })
    .filter(Boolean) as { id: string; title: string }[];

  // ── 列（カラム）の構築
  const columns: { parentId: string; nodes: TaskNode[]; depth: number }[] = [];
  for (let i = 0; i < selectedPath.length; i++) {
    const nodeId = selectedPath[i];
    const node = findNode(root, nodeId);
    if (node && node.children.length > 0) {
      columns.push({ parentId: node.id, nodes: node.children, depth: i });
    }
  }

  // ── ルートノードと第1列の接続線のY座標計算用
  // （SVGは固定サイズで描画し、列間コネクターはCSSで整列させる）

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

        <span style={{ color: 'var(--text-muted)' }}>›</span>

        <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          {project.title}
        </span>

        {breadcrumbItems.length > 0 && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>›</span>
            <Breadcrumb
              items={breadcrumbItems}
              onNavigate={(path) => navigateToPath(path)}
            />
          </>
        )}

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
      <div className="flex-1 flex overflow-x-auto overflow-y-hidden items-center p-12 gap-0">

        {/* 左端：ルートノードカード */}
        <div className="flex-shrink-0 flex items-center py-8">
          <TaskNodeCard
            node={root}
            isSelected={selectedPath[selectedPath.length - 1] === root.id}
            isRoot
            accentColor={accentColor}
            onClick={() => selectNode(root.id)}
            onToggleComplete={() => toggleComplete(project.id, root.id)}
            onUpdateTitle={(t) => updateNodeTitle(project.id, root.id, t)}
            onUpdateMemo={(m) => updateNodeMemo(project.id, root.id, m)}
            onAddChild={() => openChildModal(root.id)}
            onAddSibling={() => {}} // rootには兄弟なし
            onDelete={() => {}}     // rootは削除不可
            dragIndex={0}
            onDragStart={() => {}}
            onDragOver={() => {}}
            onDrop={() => {}}
          />
        </div>

        {/* 各列とコネクター */}
        {columns.map((column, colIndex) => {
          const isLastColumn = colIndex === columns.length - 1;
          const nodeCount = column.nodes.length;

          return (
            <div key={column.parentId} className="flex flex-shrink-0 items-stretch">
              {/* ── SVGコネクター（親→子リストを線でつなぐ） */}
              <TreeConnector count={nodeCount} accentColor={accentColor} />

              {/* ── ノード列 */}
              <div
                className="flex-shrink-0 flex flex-col justify-center gap-6 py-8"
                style={{ width: 260 }}
              >
                {column.nodes.map((node, nodeIndex) => (
                  <TaskNodeCard
                    key={node.id}
                    node={node}
                    isSelected={selectedPath.includes(node.id)}
                    accentColor={accentColor}
                    onClick={() => selectNode(node.id)}
                    onToggleComplete={() => toggleComplete(project.id, node.id)}
                    onUpdateTitle={(t) => updateNodeTitle(project.id, node.id, t)}
                    onUpdateMemo={(m) => updateNodeMemo(project.id, node.id, m)}
                    onAddChild={() => openChildModal(node.id)}
                    onAddSibling={() => openSiblingModal(node.id)}
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
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── タスク追加モーダル */}
      {modal.open && (
        <NewTaskModal
          mode={modal.mode}
          onConfirm={handleModalConfirm}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SVGコネクター: 親ノードの右端から、count個の子ノードを縦に並べた線
// ────────────────────────────────────────────────────────────
const CARD_HEIGHT   = 120; // Increased to match new padding
const CARD_GAP      = 24;  // gap-6 = 24px
const CONNECTOR_W   = 60;  // Wider connector for better curves

function TreeConnector({ count, accentColor }: { count: number; accentColor: string }) {
  if (count === 0) return null;

  const totalHeight = count * CARD_HEIGHT + (count - 1) * CARD_GAP;
  const midY = totalHeight / 2;

  // 各子ノードの中心Y
  const childCenters = Array.from({ length: count }, (_, i) =>
    i * (CARD_HEIGHT + CARD_GAP) + CARD_HEIGHT / 2
  );

  return (
    <div
      className="flex-shrink-0 flex items-center"
      style={{ width: CONNECTOR_W, height: totalHeight, position: 'relative' }}
    >
      <svg
        width={CONNECTOR_W}
        height={totalHeight}
        viewBox={`0 0 ${CONNECTOR_W} ${totalHeight}`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        {childCenters.map((cy, i) => {
          // Curved path from middle-left to child node's middle-left
          // We start from x=0, y=midY and end at x=CONNECTOR_W, y=cy
          const cp1x = CONNECTOR_W / 2;
          const cp2x = CONNECTOR_W / 2;
          const pathData = `M 0 ${midY} C ${cp1x} ${midY}, ${cp2x} ${cy}, ${CONNECTOR_W} ${cy}`;
          
          return (
            <path
              key={i}
              d={pathData}
              fill="none"
              stroke={accentColor}
              strokeWidth="2"
              strokeOpacity="0.5"
            />
          );
        })}
      </svg>
    </div>
  );
}
