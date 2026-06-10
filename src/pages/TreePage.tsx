import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useAppStore } from '../store';
import { Breadcrumb } from '../components/Breadcrumb';
import { TaskNodeCard } from '../components/TaskNodeCard';
import { NewTaskModal } from '../components/NewTaskModal';
import { NicknameDisplay } from '../components/NicknameDisplay';
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
    moveNode,
    refreshProgress,
  } = useAppStore();

  const project = projects.find((p) => p.id === currentProjectId);
  if (!project) return null;

  const root = project.rootTask;
  const accentColor = project.color;

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

        <NicknameDisplay />

        <span style={{ color: 'var(--text-muted)' }}>›</span>

        <Breadcrumb
          items={breadcrumbItems}
          onNavigate={(path) => navigateToPath(path)}
        />

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
      <div className="flex-1 overflow-x-auto overflow-y-hidden" style={{ position: 'relative' }}>
        <div className="min-w-max min-h-full flex items-center p-12 gap-[60px] relative">
          
          <ConnectionsOverlay root={root} columns={columns} accentColor={accentColor} />

          {/* 左端：ルートノードカード */}
          <div className="flex-shrink-0 flex items-center py-8" style={{ paddingLeft: '40px' }}>
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
              parentId={null}
              dragIndex={0}
              onDragOver={() => {}}
              onDrop={(draggedData) => {
                if (draggedData.id === root.id) return;
                // ルートにドロップした場合は常にルートの子になる
                moveNode(project.id, draggedData.id, root.id);
              }}
            />
          </div>

          {/* 各列 */}
          {columns.map((column) => {
            return (
              <div
                key={column.parentId}
                className="flex-shrink-0 flex flex-col justify-center py-8"
                style={{ width: 260 }}
              >
                {/* カラム先頭（一番上）へのドロップ */}
                <DropZone
                  accentColor={accentColor}
                  onDrop={(data) => {
                    if (data.id === column.parentId) return;
                    moveNode(project.id, data.id, column.parentId, 0);
                  }}
                />

                {column.nodes.map((node, nodeIndex) => (
                  <React.Fragment key={node.id}>
                    <TaskNodeCard
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
                      parentId={column.parentId}
                      dragIndex={nodeIndex}
                      onDragOver={() => {}}
                      onDrop={(draggedData) => {
                        if (draggedData.id === node.id) return;
                        // カードの上へのドロップは常に「子タスク」として追加
                        moveNode(project.id, draggedData.id, node.id);
                      }}
                    />

                    {/* カード直後（兄弟間、または一番下）へのドロップ */}
                    <DropZone
                      accentColor={accentColor}
                      onDrop={(data) => {
                        if (data.id === column.parentId) return;
                        moveNode(project.id, data.id, column.parentId, nodeIndex + 1);
                      }}
                    />
                  </React.Fragment>
                ))}
              </div>
            );
          })}
        </div>
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
// ドロップゾーン: カードの間に配置し、兄弟タスクとしてドロップできる領域
// ────────────────────────────────────────────────────────────
function DropZone({ accentColor, onDrop }: { accentColor: string; onDrop: (data: { id: string; parentId: string | null; index: number }) => void }) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setIsOver(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          if (data && data.id) onDrop(data);
        } catch (err) {
          console.error('Drop error', err);
        }
      }}
      className="flex-shrink-0 flex items-center justify-center transition-all duration-150"
      style={{
        height: 24, // カード間の隙間（旧 gap-6）と同等の高さを確保
        width: '100%',
        position: 'relative',
        zIndex: 20,
      }}
    >
      {/* 橙色の横線（ドラッグオーバー時のみ表示） */}
      <div
        className="w-full rounded-full transition-all duration-150 pointer-events-none"
        style={{
          height: isOver ? 4 : 0,
          background: accentColor,
          boxShadow: isOver ? `0 0 8px ${accentColor}` : 'none',
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// SVGコネクター: 各ノードのDOM座標を監視し、動的にベジェ曲線を描画
// ドラッグ&ドロップやテキスト入力によるレイアウト変更に即座に追従します
// ────────────────────────────────────────────────────────────
function ConnectionsOverlay({
  root,
  columns,
  accentColor,
}: {
  root: TaskNode;
  columns: { parentId: string; nodes: TaskNode[] }[];
  accentColor: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);

  useEffect(() => {
    let animationFrameId: number;
    const lastPositions = new Map<string, string>();

    const updateLines = () => {
      const svg = svgRef.current;
      if (!svg) {
        animationFrameId = requestAnimationFrame(updateLines);
        return;
      }
      
      const svgRect = svg.getBoundingClientRect();
      const newPaths: { id: string; d: string }[] = [];
      let changed = false;

      // 描画すべきすべての「親 → 子」のペアをリスト化
      const links: { parentId: string; childId: string }[] = [];
      if (columns.length > 0) {
        links.push(...columns[0].nodes.map((node) => ({ parentId: root.id, childId: node.id })));
        for (let i = 1; i < columns.length; i++) {
          const col = columns[i];
          links.push(...col.nodes.map((node) => ({ parentId: col.parentId, childId: node.id })));
        }
      }

      links.forEach((link) => {
        const parentEl = document.getElementById(`node-${link.parentId}`);
        const childEl = document.getElementById(`node-${link.childId}`);

        if (parentEl && childEl) {
          const pRect = parentEl.getBoundingClientRect();
          const cRect = childEl.getBoundingClientRect();

          // 親の右端中央
          const startX = pRect.right - svgRect.left;
          const startY = pRect.top + pRect.height / 2 - svgRect.top;

          // 子の左端中央
          const endX = cRect.left - svgRect.left;
          const endY = cRect.top + cRect.height / 2 - svgRect.top;

          // 滑らかなベジェ曲線の制御点（距離に応じて曲がり具合を調整）
          const distanceX = Math.max((endX - startX) / 2, 20);
          const cp1x = startX + distanceX;
          const cp1y = startY;
          const cp2x = endX - distanceX;
          const cp2y = endY;

          const d = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
          const id = `${link.parentId}-${link.childId}`;
          newPaths.push({ id, d });

          if (lastPositions.get(id) !== d) {
            changed = true;
            lastPositions.set(id, d);
          }
        }
      });

      // 削除されたノードなどの検知（パスの数が変わった場合）
      if (changed || newPaths.length !== lastPositions.size) {
        if (newPaths.length !== lastPositions.size) {
          const newKeys = new Set(newPaths.map((p) => p.id));
          for (const key of lastPositions.keys()) {
            if (!newKeys.has(key)) lastPositions.delete(key);
          }
          changed = true;
        }

        if (changed) {
          setPaths(newPaths);
        }
      }

      animationFrameId = requestAnimationFrame(updateLines);
    };

    animationFrameId = requestAnimationFrame(updateLines);
    return () => cancelAnimationFrame(animationFrameId);
  }, [root, columns]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // マウスイベントを下のノードに貫通させる
        zIndex: 0,             // ノードの背面に描画
        overflow: 'visible',
      }}
    >
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          fill="none"
          stroke={accentColor}
          strokeWidth="2"
          strokeOpacity="0.5"
        />
      ))}
    </svg>
  );
}
