import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { Breadcrumb } from '../components/Breadcrumb';
import { TaskNodeCard } from '../components/TaskNodeCard';
import { NewTaskModal } from '../components/NewTaskModal';
import Header from '../components/Header';
import RightDrawerPanel from '../components/RightDrawerPanel';
import type { TaskNode } from '../types';

type DraggedNodeData = {
  id: string;
  parentId: string | null;
  index: number;
};

type TreeColumn = {
  parentId: string;
  nodes: TaskNode[];
  depth: number;
};

/** ノードIDからノードを再帰的に検索する */
function findNode(root: TaskNode, id: string): TaskNode | null {
  if (root.id === id) return root;

  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }

  return null;
}

/** ショートカットキーを無視すべき入力中ターゲットか判定 */
function shouldIgnoreShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      'input, textarea, select, button, a, [contenteditable="true"]',
    ),
  );
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
    rightPanel,
    isPatchNotesModalOpen,

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

  const project = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? null,
    [projects, currentProjectId],
  );

  const projectId = project?.id ?? null;
  const root = project?.rootTask ?? null;
  const rootId = root?.id ?? null;
  const accentColor = project?.color ?? '#3b82f6';

  // ── タスク追加モーダルの状態
  const [modal, setModal] = useState<ModalState>({ open: false });

  // モーダルを開くヘルパー
  const openChildModal = useCallback((targetId: string) => {
    setModal({ open: true, mode: 'child', targetId });
  }, []);

  const openSiblingModal = useCallback((targetId: string) => {
    setModal({ open: true, mode: 'sibling', targetId });
  }, []);

  const closeModal = useCallback(() => {
    setModal({ open: false });
  }, []);

  // selectedPath が空の場合はルートを選択状態に戻す
  useEffect(() => {
    if (!rootId) return;
    if (selectedPath.length > 0) return;

    navigateToPath([rootId]);
  }, [rootId, selectedPath.length, navigateToPath]);

  // モーダル確定ハンドラ
  const handleModalConfirm = useCallback(
    (title: string, memo: string) => {
      if (!modal.open) return;
      if (!projectId) return;

      const newId =
        modal.mode === 'child'
          ? addChildNode(projectId, modal.targetId, title, memo)
          : addSiblingNode(projectId, modal.targetId, title, memo);

      selectNode(newId);
      closeModal();
    },
    [
      modal,
      projectId,
      addChildNode,
      addSiblingNode,
      selectNode,
      closeModal,
    ],
  );

  // ── グローバルキーボードショートカット
  const lastSelectedId = selectedPath[selectedPath.length - 1] ?? null;

  useEffect(() => {
    if (!rootId) return;
    if (modal.open) return;
    if (rightPanel.isOpen) return;
    if (isPatchNotesModalOpen) return;

    const handler = (event: KeyboardEvent) => {
      if (shouldIgnoreShortcutTarget(event.target)) return;
      if (!lastSelectedId) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        openChildModal(lastSelectedId);
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();

        // ルートノードには兄弟を追加しない
        if (lastSelectedId === rootId) return;

        openSiblingModal(lastSelectedId);
      }
    };

    document.addEventListener('keydown', handler);

    return () => {
      document.removeEventListener('keydown', handler);
    };
  }, [
    modal.open,
    rightPanel.isOpen,
    isPatchNotesModalOpen,
    lastSelectedId,
    rootId,
    openChildModal,
    openSiblingModal,
  ]);

  // ── パンくずリスト用
  const breadcrumbItems = useMemo(() => {
    if (!root) return [];

    return selectedPath
      .map((id) => {
        const node = findNode(root, id);
        return node ? { id: node.id, title: node.title } : null;
      })
      .filter((item): item is { id: string; title: string } => item !== null);
  }, [root, selectedPath]);

  // ── 列（カラム）の構築
  const columns = useMemo<TreeColumn[]>(() => {
    if (!root) return [];

    const nextColumns: TreeColumn[] = [];

    for (let index = 0; index < selectedPath.length; index += 1) {
      const nodeId = selectedPath[index];
      const node = findNode(root, nodeId);

      if (node && node.children.length > 0) {
        nextColumns.push({
          parentId: node.id,
          nodes: node.children,
          depth: index,
        });
      }
    }

    return nextColumns;
  }, [root, selectedPath]);

  if (!project || !root || !projectId) {
    return <ProjectMissingView onBackToDashboard={goToDashboard} />;
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* ── 共通ヘッダー */}
      <Header
        onLogoClick={goToDashboard}
        onRefreshProgress={refreshProgress}
        breadcrumbsSlot={
          <Breadcrumb
            items={breadcrumbItems}
            onNavigate={(path) => navigateToPath(path)}
          />
        }
      />

      {/* ── 右側スライドインパネル */}
      <RightDrawerPanel />

      {/* ── 操作ガイド */}
      <div
        className="flex items-center gap-4 px-6 py-1.5 text-xs flex-shrink-0"
        style={{
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-muted)',
        }}
      >
        <span>💡 ヒント:</span>
        <span>
          <kbd
            style={{
              background: 'var(--bg-elevated)',
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            Enter
          </kbd>{' '}
          子タスク追加
        </span>
        <span>
          <kbd
            style={{
              background: 'var(--bg-elevated)',
              padding: '1px 5px',
              borderRadius: 4,
              fontSize: 11,
            }}
          >
            Tab
          </kbd>{' '}
          兄弟タスク追加
        </span>
        <span>ダブルクリックでタイトル・メモを編集 / ドラッグで並び替え</span>
      </div>

      {/* ── ツリービュー本体（横スクロール） */}
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden"
        style={{ position: 'relative' }}
      >
        <div className="min-w-max min-h-full flex items-center p-12 gap-[60px] relative">
          <ConnectionsOverlay
            root={root}
            columns={columns}
            accentColor={accentColor}
          />

          {/* 左端：ルートノードカード */}
          <div
            className="flex-shrink-0 flex items-center py-8"
            style={{ paddingLeft: '40px' }}
          >
            <TaskNodeCard
              node={root}
              isSelected={selectedPath[selectedPath.length - 1] === root.id}
              isRoot
              accentColor={accentColor}
              onClick={() => selectNode(root.id)}
              onToggleComplete={() => toggleComplete(project.id, root.id)}
              onUpdateTitle={(title) =>
                updateNodeTitle(project.id, root.id, title)
              }
              onUpdateMemo={(memo) =>
                updateNodeMemo(project.id, root.id, memo)
              }
              onAddChild={() => openChildModal(root.id)}
              onAddSibling={() => {
                // rootには兄弟なし
              }}
              onDelete={() => {
                // rootは削除不可
              }}
              parentId={null}
              dragIndex={0}
              onDragOver={() => {
                // TaskNodeCard側の型に合わせた no-op
              }}
              onDrop={(draggedData: DraggedNodeData) => {
                if (draggedData.id === root.id) return;

                // ルートにドロップした場合は常にルートの子になる
                moveNode(project.id, draggedData.id, root.id);
              }}
            />
          </div>

          {/* 各列 */}
          {columns.map((column) => (
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
                    onUpdateTitle={(title) =>
                      updateNodeTitle(project.id, node.id, title)
                    }
                    onUpdateMemo={(memo) =>
                      updateNodeMemo(project.id, node.id, memo)
                    }
                    onAddChild={() => openChildModal(node.id)}
                    onAddSibling={() => openSiblingModal(node.id)}
                    onDelete={() => {
                      const ok = window.confirm(
                        `「${node.title}」を削除しますか？\n子タスクもすべて削除されます。`,
                      );

                      if (ok) {
                        deleteNode(project.id, node.id);
                      }
                    }}
                    parentId={column.parentId}
                    dragIndex={nodeIndex}
                    onDragOver={() => {
                      // TaskNodeCard側の型に合わせた no-op
                    }}
                    onDrop={(draggedData: DraggedNodeData) => {
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

                      moveNode(
                        project.id,
                        data.id,
                        column.parentId,
                        nodeIndex + 1,
                      );
                    }}
                  />
                </React.Fragment>
              ))}
            </div>
          ))}
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
// プロジェクトが見つからない場合のフォールバック表示
// ────────────────────────────────────────────────────────────

function ProjectMissingView({
  onBackToDashboard,
}: {
  onBackToDashboard: () => void;
}) {
  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      <Header onLogoClick={onBackToDashboard} />

      <RightDrawerPanel />

      <main
        className="flex-1 flex items-center justify-center"
        style={{ color: 'var(--text-main)' }}
      >
        <div
          style={{
            width: 'min(420px, calc(100vw - 32px))',
            border: '1px solid var(--border)',
            borderRadius: 18,
            padding: 24,
            background: 'var(--bg-elevated)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 38, marginBottom: 12 }}>📂</div>

          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--text-main)',
            }}
          >
            プロジェクトが見つかりません
          </h2>

          <p
            style={{
              margin: '10px 0 18px',
              color: 'var(--text-muted)',
              fontSize: 13,
              lineHeight: 1.7,
            }}
          >
            選択中のプロジェクトが削除されたか、保存データとの整合性が崩れている可能性があります。
          </p>

          <button
            type="button"
            onClick={onBackToDashboard}
            style={{
              height: 36,
              padding: '0 14px',
              borderRadius: 11,
              border: '1px solid rgba(59, 130, 246, 0.42)',
              background: 'rgba(37, 99, 235, 0.18)',
              color: '#bfdbfe',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            プロジェクト一覧へ戻る
          </button>
        </div>
      </main>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// ドロップゾーン: カードの間に配置し、兄弟タスクとしてドロップできる領域
// ────────────────────────────────────────────────────────────

function DropZone({
  accentColor,
  onDrop,
}: {
  accentColor: string;
  onDrop: (data: DraggedNodeData) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'move';
        setIsOver(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsOver(false);

        try {
          const rawData = event.dataTransfer.getData('application/json');
          const parsedData = JSON.parse(rawData) as Partial<DraggedNodeData>;

          if (parsedData && typeof parsedData.id === 'string') {
            onDrop({
              id: parsedData.id,
              parentId:
                typeof parsedData.parentId === 'string'
                  ? parsedData.parentId
                  : null,
              index:
                typeof parsedData.index === 'number'
                  ? parsedData.index
                  : 0,
            });
          }
        } catch (error) {
          console.error('Drop error', error);
        }
      }}
      className="flex-shrink-0 flex items-center justify-center transition-all duration-150"
      style={{
        height: 24,
        width: '100%',
        position: 'relative',
        zIndex: 20,
      }}
    >
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
  columns: TreeColumn[];
  accentColor: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);

  useEffect(() => {
    let animationFrameId = 0;
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
        links.push(
          ...columns[0].nodes.map((node) => ({
            parentId: root.id,
            childId: node.id,
          })),
        );

        for (let index = 1; index < columns.length; index += 1) {
          const column = columns[index];

          links.push(
            ...column.nodes.map((node) => ({
              parentId: column.parentId,
              childId: node.id,
            })),
          );
        }
      }

      links.forEach((link) => {
        const parentElement = document.getElementById(`node-${link.parentId}`);
        const childElement = document.getElementById(`node-${link.childId}`);

        if (!parentElement || !childElement) return;

        const parentRect = parentElement.getBoundingClientRect();
        const childRect = childElement.getBoundingClientRect();

        // 親の右端中央
        const startX = parentRect.right - svgRect.left;
        const startY = parentRect.top + parentRect.height / 2 - svgRect.top;

        // 子の左端中央
        const endX = childRect.left - svgRect.left;
        const endY = childRect.top + childRect.height / 2 - svgRect.top;

        // 滑らかなベジェ曲線の制御点
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
      });

      // 削除されたノードなどの検知
      if (changed || newPaths.length !== lastPositions.size) {
        if (newPaths.length !== lastPositions.size) {
          const newKeys = new Set(newPaths.map((path) => path.id));

          for (const key of lastPositions.keys()) {
            if (!newKeys.has(key)) {
              lastPositions.delete(key);
            }
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

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
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
        pointerEvents: 'none',
        zIndex: 0,
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
