import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { Breadcrumb } from '../components/Breadcrumb';
import { TaskNodeCard } from '../components/TaskNodeCard';
import { NewTaskModal } from '../components/NewTaskModal';
import Header from '../components/Header';
import RightDrawerPanel from '../components/RightDrawerPanel';
import type { TaskNode } from '../types';
import {
  computeTreeLayout,
  useNodeHeights,
  useTreeExpandAnimation,
  findNode,
  buildParentMap,
  ConnectionsOverlay,
  isNodeExpanded,
  type TreeColumn,
} from '../lib/tree';
import {
  TREE_LAYOUT_CONFIG,
  CANVAS_PADDING,
  EXIT_TRANSITION_MS,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  DEFAULT_ZOOM,
} from './TreePage.config';

type DraggedNodeData = {
  id: string;
  parentId: string | null;
  index: number;
};

const {
  cardWidth: CARD_WIDTH,
  rootWidth: ROOT_WIDTH,
  dropZoneHeight: DROP_ZONE_HEIGHT,
} = TREE_LAYOUT_CONFIG;

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
    collapsedNodeIds,
    rightPanel,
    isPatchNotesModalOpen,

    goToDashboard,
    selectNode,
    navigateToPath,
    toggleNodeExpanded,

    addChildNode,
    addSiblingNode,
    deleteNode,
    toggleComplete,
    updateNodeTitle,
    updateNodeMemo,
    moveNode,
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

  // ── 画面比率（ズーム）
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);

  // ── ドラッグで画面を動かす（パン）
  const scrollRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  const handleCanvasMouseDown = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // カード・ドロップゾーンなど背景以外の要素上では発火させない
      if (event.target !== event.currentTarget) return;
      if (event.button !== 0) return;

      const scrollEl = scrollRef.current;
      if (!scrollEl) return;

      panStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        scrollLeft: scrollEl.scrollLeft,
        scrollTop: scrollEl.scrollTop,
      };
      setIsPanning(true);

      // ドラッグ中に他の要素のテキストが選択されてしまうのを防ぐ
      const previousUserSelect = document.body.style.userSelect;
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const panState = panStateRef.current;
        const scrollTarget = scrollRef.current;
        if (!panState || !scrollTarget) return;

        scrollTarget.scrollLeft =
          panState.scrollLeft - (moveEvent.clientX - panState.startX);
        scrollTarget.scrollTop =
          panState.scrollTop - (moveEvent.clientY - panState.startY);
      };

      const handleMouseUp = () => {
        panStateRef.current = null;
        setIsPanning(false);
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [],
  );

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
    (
      title: string,
      memo: string,
      detailMemo: string,
      dueDate: string | null,
      isPriority: boolean,
    ) => {
      if (!modal.open) return;
      if (!projectId) return;

      const newId =
        modal.mode === 'child'
          ? addChildNode(
              projectId,
              modal.targetId,
              title,
              memo,
              detailMemo,
              dueDate,
              isPriority,
            )
          : addSiblingNode(
              projectId,
              modal.targetId,
              title,
              memo,
              detailMemo,
              dueDate,
              isPriority,
            );

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

  // ── ノードごとの開閉状態（選択状態とは独立）
  const collapsedSet = useMemo(
    () => new Set(collapsedNodeIds),
    [collapsedNodeIds],
  );

  // ── 列（カラム）の構築: 開いているノードをすべて辿る（複数の枝を同時に開ける）
  const columns = useMemo<TreeColumn<TaskNode>[]>(() => {
    if (!root) return [];

    const nextColumns: TreeColumn<TaskNode>[] = [];

    const visit = (node: TaskNode, depth: number) => {
      if (node.children.length === 0) return;
      // ルートは常に展開扱い（開閉トグルを持たないため）
      if (depth > 0 && !isNodeExpanded(node, collapsedSet)) return;

      nextColumns.push({ parentId: node.id, nodes: node.children, depth });

      for (const child of node.children) {
        visit(child, depth + 1);
      }
    };

    visit(root, 0);

    return nextColumns;
  }, [root, collapsedSet]);

  // ── 各ノードIDから親IDを引くためのマップ（木構造全体から作るため、開閉で
  // 非表示になっているノードの親も辿れる。開くアニメーションの出発点、
  // 閉じるアニメーションの収束先の計算に使用）
  const parentOf = useMemo(
    () => (root ? buildParentMap(root) : new Map<string, string>()),
    [root],
  );

  // ── 各ノードの実測高さから座標を計算（子ノード群の中心に親を合わせる）
  const nodeHeights = useNodeHeights(zoom);

  const layout = useMemo(() => {
    if (!root) return null;
    return computeTreeLayout(root, collapsedSet, nodeHeights, TREE_LAYOUT_CONFIG);
  }, [root, collapsedSet, nodeHeights]);

  // ── ノードの開閉に伴う「現れる/消える」アニメーション
  const { exitingNodes, enteringNodes } = useTreeExpandAnimation(
    layout,
    parentOf,
    EXIT_TRANSITION_MS,
  );

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
        rightSlot={<ZoomBar zoom={zoom} onChange={setZoom} />}
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
        <span>
          ダブルクリックでタイトル・メモを編集 / カードをドラッグで並び替え /
          背景をドラッグで画面移動
        </span>
      </div>

      {/* ── ツリービュー本体（縦横スクロール＋画面比率変更＋ドラッグでパン） */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-auto"
        style={{ position: 'relative' }}
      >
        <div
          style={{
            position: 'relative',
            width: ((layout?.width ?? 0) + CANVAS_PADDING * 2) * zoom,
            height: ((layout?.height ?? 0) + CANVAS_PADDING * 2) * zoom,
          }}
        >
          <div
              onMouseDown={handleCanvasMouseDown}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: (layout?.width ?? 0) + CANVAS_PADDING * 2,
                height: (layout?.height ?? 0) + CANVAS_PADDING * 2,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
                cursor: isPanning ? 'grabbing' : 'grab',
                userSelect: isPanning ? 'none' : undefined,
              }}
            >
              <ConnectionsOverlay
                columns={columns}
                zoom={zoom}
                layout={layout}
              />

              {/* ルートノードカード */}
              <div
                style={{
                  position: 'absolute',
                  left: CANVAS_PADDING,
                  top: CANVAS_PADDING,
                  width: ROOT_WIDTH,
                  transform: `translate(${layout?.positions.get(root.id)?.x ?? 0}px, ${layout?.positions.get(root.id)?.y ?? 0}px)`,
                  transition: 'transform 220ms ease',
                }}
              >
                <TaskNodeCard
                  node={root}
                  isSelected={
                    selectedPath[selectedPath.length - 1] === root.id
                  }
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

              {/* 各ノードカード（実測レイアウトによる絶対配置） */}
              {columns.flatMap((column) =>
                column.nodes.map((node, nodeIndex) => {
                  const pos = layout?.positions.get(node.id);
                  if (!pos) return null;

                  // 新規出現中のノードは、最終位置ではなく親の出発位置から描画する
                  const renderPos = enteringNodes.get(node.id) ?? pos;

                  return (
                    <div
                      key={node.id}
                      style={{
                        position: 'absolute',
                        left: CANVAS_PADDING,
                        top: CANVAS_PADDING,
                        width: CARD_WIDTH,
                        transform: `translate(${renderPos.x}px, ${renderPos.y}px)`,
                        transition: 'transform 220ms ease',
                      }}
                    >
                      <TaskNodeCard
                        node={node}
                        isSelected={
                          selectedPath[selectedPath.length - 1] === node.id
                        }
                        accentColor={accentColor}
                        onClick={() => selectNode(node.id)}
                        isExpanded={isNodeExpanded(node, collapsedSet)}
                        // 分岐（子が複数）していない開閉は見た目がほぼ変わらないため、
                        // 分岐しているノードだけ開閉ボタンを出す（Combo-LABと同じ仕様）
                        onToggleExpand={
                          node.children.length > 1
                            ? () => toggleNodeExpanded(node.id)
                            : undefined
                        }
                        onToggleComplete={() =>
                          toggleComplete(project.id, node.id)
                        }
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
                    </div>
                  );
                }),
              )}

              {/* 閉じられて消えていくノード（閉じた親ノードの位置に吸い込まれながらフェードアウト） */}
              {Array.from(exitingNodes.entries())
                .filter(([id]) => !layout?.positions.has(id))
                .map(([id, pos]) => {
                  const node = findNode(root, id);
                  if (!node) return null;

                  return (
                    <div
                      key={id}
                      style={{
                        position: 'absolute',
                        left: CANVAS_PADDING,
                        top: CANVAS_PADDING,
                        width: CARD_WIDTH,
                        transform: `translate(${pos.x}px, ${pos.y}px)`,
                        transition: `transform ${EXIT_TRANSITION_MS}ms ease, opacity ${EXIT_TRANSITION_MS}ms ease`,
                        opacity: 0,
                        pointerEvents: 'none',
                      }}
                    >
                      <TaskNodeCard
                        node={node}
                        isSelected={false}
                        accentColor={accentColor}
                        onClick={() => {
                          // フェードアウト中は操作不可
                        }}
                        onToggleComplete={() => {
                          // フェードアウト中は操作不可
                        }}
                        onUpdateTitle={() => {
                          // フェードアウト中は操作不可
                        }}
                        onUpdateMemo={() => {
                          // フェードアウト中は操作不可
                        }}
                        onAddChild={() => {
                          // フェードアウト中は操作不可
                        }}
                        onAddSibling={() => {
                          // フェードアウト中は操作不可
                        }}
                        onDelete={() => {
                          // フェードアウト中は操作不可
                        }}
                        parentId={null}
                        dragIndex={0}
                        onDragOver={() => {
                          // フェードアウト中は操作不可
                        }}
                        onDrop={() => {
                          // フェードアウト中は操作不可
                        }}
                      />
                    </div>
                  );
                })}

              {/* 兄弟間ドロップゾーン（実測レイアウトによる絶対配置） */}
              {layout?.dropZones.map((dropZone) => (
                <div
                  key={dropZone.key}
                  style={{
                    position: 'absolute',
                    left: CANVAS_PADDING + dropZone.x,
                    top: CANVAS_PADDING + dropZone.y,
                    width: CARD_WIDTH,
                    height: DROP_ZONE_HEIGHT,
                  }}
                >
                  <DropZone
                    accentColor={accentColor}
                    onDrop={(data) => {
                      if (data.id === dropZone.parentId) return;

                      moveNode(
                        project.id,
                        data.id,
                        dropZone.parentId,
                        dropZone.insertIndex,
                      );
                    }}
                  />
                </div>
              ))}
            </div>
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
          height: isOver ? 3.2 : 0,
          background: accentColor,
          boxShadow: isOver ? `0 0 8px ${accentColor}` : 'none',
        }}
      />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// 画面比率（ズーム）バー: PowerPointなどの下部ズームバーに相当
// ────────────────────────────────────────────────────────────

function ZoomBar({
  zoom,
  onChange,
}: {
  zoom: number;
  onChange: (zoom: number) => void;
}) {
  const clamp = (value: number) =>
    Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));

  return (
    <div
      className="flex-shrink-0 flex items-center gap-2"
      style={{
        height: 32,
        padding: '0 10px',
        borderRadius: 11,
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(148, 163, 184, 0.2)',
      }}
    >
      <button
        type="button"
        onClick={() => onChange(clamp(zoom - ZOOM_STEP))}
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          background: 'transparent',
          color: '#e5e7eb',
          cursor: 'pointer',
          fontSize: 13,
          lineHeight: 1,
        }}
        title="縮小"
      >
        −
      </button>

      <input
        type="range"
        min={MIN_ZOOM}
        max={MAX_ZOOM}
        step={0.05}
        value={zoom}
        onChange={(event) => onChange(clamp(Number(event.target.value)))}
        style={{ width: 80, cursor: 'pointer' }}
      />

      <button
        type="button"
        onClick={() => onChange(clamp(zoom + ZOOM_STEP))}
        className="flex-shrink-0 flex items-center justify-center"
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          background: 'transparent',
          color: '#e5e7eb',
          cursor: 'pointer',
          fontSize: 13,
          lineHeight: 1,
        }}
        title="拡大"
      >
        ＋
      </button>

      <button
        type="button"
        onClick={() => onChange(1)}
        style={{
          minWidth: 34,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 700,
          color: '#94a3b8',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        title="100%に戻す"
      >
        {Math.round(zoom * 100)}%
      </button>
    </div>
  );
}
