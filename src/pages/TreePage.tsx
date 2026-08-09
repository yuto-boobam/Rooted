import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

// ── ツリーレイアウト定数（カード実寸・列間隔など） ─────────────────────────
const CARD_WIDTH = 245;
const ROOT_WIDTH = 220;
const GAP_X = 50;
const DROP_ZONE_HEIGHT = 18;
const DEFAULT_NODE_HEIGHT = 76;
const DEFAULT_ROOT_HEIGHT = 110;
const CANVAS_PADDING = 48;
const EXIT_TRANSITION_MS = 200;

// ── 画面比率（ズーム）定数 ───────────────────────────────────────────────
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

type NodePosition = { x: number; y: number; height: number };

type DropZoneSpec = {
  key: string;
  parentId: string;
  insertIndex: number;
  x: number;
  y: number;
};

type TreeLayout = {
  positions: Map<string, NodePosition>;
  dropZones: DropZoneSpec[];
  width: number;
  height: number;
};

/**
 * 実測したカード高さを元に、各ノードの座標を計算する。
 * 子を持つノードは「自分の子ノード群の中心」に縦位置を合わせ、葉ノードは
 * 木全体で重ならないよう順番に積み上げる（いわゆる tidy tree レイアウト）。
 */
function computeTreeLayout(
  root: TaskNode,
  collapsedSet: Set<string>,
  heights: Record<string, number>,
): TreeLayout {
  const heightOf = (id: string, isRoot: boolean) =>
    heights[id] ?? (isRoot ? DEFAULT_ROOT_HEIGHT : DEFAULT_NODE_HEIGHT);

  const depthX = (depth: number) =>
    depth === 0 ? 0 : ROOT_WIDTH + GAP_X + (depth - 1) * (CARD_WIDTH + GAP_X);

  // ルートは開閉トグルを持たないため常に展開扱い
  const isExpanded = (node: TaskNode, depth: number) =>
    depth === 0 || !collapsedSet.has(node.id);

  const requiredCache = new Map<string, number>();

  // 1段目: 各ノードが必要とする縦幅を子から積み上げて求める
  const computeRequired = (node: TaskNode, depth: number): number => {
    const cached = requiredCache.get(node.id);
    if (cached !== undefined) return cached;

    const own = heightOf(node.id, depth === 0);
    const children = isExpanded(node, depth) ? node.children : [];

    let required = own;
    if (children.length > 0) {
      const block =
        children.reduce(
          (sum, child) => sum + computeRequired(child, depth + 1),
          0,
        ) +
        (children.length + 1) * DROP_ZONE_HEIGHT;

      required = Math.max(own, block);
    }

    requiredCache.set(node.id, required);
    return required;
  };

  computeRequired(root, 0);

  // 2段目: 必要な縦幅を元に、実際の座標を割り当てる
  const positions = new Map<string, NodePosition>();
  const dropZones: DropZoneSpec[] = [];
  let maxDepth = 0;

  // 戻り値: このノード自身の縦方向の中心Y座標
  const assign = (node: TaskNode, depth: number, topY: number): number => {
    maxDepth = Math.max(maxDepth, depth);

    const own = heightOf(node.id, depth === 0);
    const required = requiredCache.get(node.id) ?? own;
    const children = isExpanded(node, depth) ? node.children : [];

    if (children.length === 0) {
      // required === own のため、そのまま配置してよい
      positions.set(node.id, { x: depthX(depth), y: topY, height: own });
      return topY + own / 2;
    }

    const block =
      children.reduce(
        (sum, child) => sum + (requiredCache.get(child.id) ?? 0),
        0,
      ) +
      (children.length + 1) * DROP_ZONE_HEIGHT;

    let cursorY = topY + (required - block) / 2;

    dropZones.push({
      key: `${node.id}-0`,
      parentId: node.id,
      insertIndex: 0,
      x: depthX(depth + 1),
      y: cursorY,
    });
    cursorY += DROP_ZONE_HEIGHT;

    const childCenters: number[] = [];

    children.forEach((child, index) => {
      childCenters.push(assign(child, depth + 1, cursorY));
      cursorY += requiredCache.get(child.id) ?? 0;

      dropZones.push({
        key: `${node.id}-${index + 1}`,
        parentId: node.id,
        insertIndex: index + 1,
        x: depthX(depth + 1),
        y: cursorY,
      });
      cursorY += DROP_ZONE_HEIGHT;
    });

    // 直接の子どもたち（最初と最後）の中心に自分を合わせる。
    // ただし自分の持ち場（[topY, topY + required]）からはみ出さないよう安全域にクランプする。
    const rawCenter =
      (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    const nodeY = Math.min(
      Math.max(rawCenter - own / 2, topY),
      topY + required - own,
    );

    positions.set(node.id, { x: depthX(depth), y: nodeY, height: own });
    return nodeY + own / 2;
  };

  assign(root, 0, 0);

  const totalHeight = requiredCache.get(root.id) ?? heightOf(root.id, true);
  const totalWidth =
    depthX(maxDepth) + (maxDepth === 0 ? ROOT_WIDTH : CARD_WIDTH);

  return { positions, dropZones, width: totalWidth, height: totalHeight };
}

/**
 * 現在DOM上にあるノードカードの実寸高さを計測する。
 * 毎フレームポーリングする代わりに、実際にサイズが変化した時だけ反応する
 * ResizeObserverを使う（アイドル時のCPU消費を避けるため）。ノードの増減は
 * MutationObserverで検知し、観測対象を追従させる。
 */
function useNodeHeights(zoom: number): Record<string, number> {
  const [heights, setHeights] = useState<Record<string, number>>({});
  const latestRef = useRef<Record<string, number>>({});
  const observedRef = useRef<Set<Element>>(new Set());

  // ズームは値が変わるたびにobserverを張り直す必要はなく（測定値をズームで
  // 割った論理サイズはズーム非依存のため）、計測時に最新値を参照できれば十分
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  useEffect(() => {
    const applyMeasurement = (element: Element) => {
      const id = element.id.slice('node-'.length);
      // 実測値はズームで拡縮された画面上のサイズなので、論理サイズに戻す
      const measuredHeight = Math.round(
        element.getBoundingClientRect().height / zoomRef.current,
      );

      if (measuredHeight > 0 && latestRef.current[id] !== measuredHeight) {
        latestRef.current = { ...latestRef.current, [id]: measuredHeight };
        setHeights(latestRef.current);
      }
    };

    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => applyMeasurement(entry.target));
    });

    // 開閉操作でノードカードのDOM要素が増減するたびに、観測対象を同期する
    const syncObservedElements = () => {
      const elements = document.querySelectorAll<HTMLElement>('[id^="node-"]');
      const currentSet = new Set<Element>(elements);

      currentSet.forEach((element) => {
        if (!observedRef.current.has(element)) {
          resizeObserver.observe(element);
          observedRef.current.add(element);
          applyMeasurement(element);
        }
      });

      observedRef.current.forEach((element) => {
        if (!currentSet.has(element)) {
          resizeObserver.unobserve(element);
          observedRef.current.delete(element);
        }
      });
    };

    syncObservedElements();

    const mutationObserver = new MutationObserver(syncObservedElements);
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      observedRef.current.clear();
    };
  }, []);

  return heights;
}

/** ノードIDからノードを再帰的に検索する */
function findNode(root: TaskNode, id: string): TaskNode | null {
  if (root.id === id) return root;

  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }

  return null;
}

/**
 * 閉じて消えるノードの収束先座標を求める。
 * 直接の親も一緒に消えている場合（複数階層が同時に閉じる場合）があるため、
 * 現在も表示されている祖先が見つかるまで親をたどる。
 */
function findConvergenceTarget(
  id: string,
  parentOf: Map<string, string>,
  currentPositions: Map<string, NodePosition>,
): NodePosition | null {
  let cursor = parentOf.get(id);

  while (cursor) {
    const pos = currentPositions.get(cursor);
    if (pos) return pos;
    cursor = parentOf.get(cursor);
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
  const [zoom, setZoom] = useState(1);

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
  const columns = useMemo<TreeColumn[]>(() => {
    if (!root) return [];

    const nextColumns: TreeColumn[] = [];

    const visit = (node: TaskNode, depth: number) => {
      if (node.children.length === 0) return;
      // ルートは常に展開扱い（開閉トグルを持たないため）
      if (depth > 0 && collapsedSet.has(node.id)) return;

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
  const parentOf = useMemo(() => {
    const map = new Map<string, string>();

    const walk = (node: TaskNode) => {
      node.children.forEach((child) => {
        map.set(child.id, node.id);
        walk(child);
      });
    };

    if (root) walk(root);
    return map;
  }, [root]);

  // ── 各ノードの実測高さから座標を計算（子ノード群の中心に親を合わせる）
  const nodeHeights = useNodeHeights(zoom);

  const layout = useMemo(() => {
    if (!root) return null;
    return computeTreeLayout(root, collapsedSet, nodeHeights);
  }, [root, collapsedSet, nodeHeights]);

  // ── ノードが閉じられて消える際、閉じた親の位置に吸い込まれながらフェードアウトさせる
  const prevVisibleIdsRef = useRef<Set<string>>(new Set());
  const prevPositionsRef = useRef<Map<string, NodePosition>>(new Map());
  const prevExitingNodesRef = useRef<Map<string, NodePosition>>(new Map());
  const [exitingNodes, setExitingNodes] = useState<
    Map<string, NodePosition>
  >(new Map());

  // ── ノードが新しく開いて現れる際、直前の「親の位置」から最終位置へ滑らせる
  const [enteringNodes, setEnteringNodes] = useState<
    Map<string, NodePosition>
  >(new Map());

  // ── 開閉アニメーションが仕掛けるタイマーを、アンマウント時にまとめて解除するための管理。
  // ※ rAFはここでは追跡しない。開発時のStrictModeはマウント時に
  //   「エフェクト実行→クリーンアップ→再実行」を行うが、rafを共有refで
  //   キャンセルしてしまうと、この2段構えのrAFが本来の再実行より先に
  //   打ち切られ、enteringNodesのエントリが永久に残ってしまう不具合があった
  //   （2回目の実行はprevVisibleIdsRef等が既に更新済みのため何もしない）。
  //   代わりにisMountedRefで「本当のアンマウント後だけsetStateを避ける」方式にする。
  const pendingTimersRef = useRef<{ timeouts: Set<number> }>({
    timeouts: new Set(),
  });
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const pendingTimers = pendingTimersRef.current;

    return () => {
      isMountedRef.current = false;
      pendingTimers.timeouts.forEach((id) => window.clearTimeout(id));
      pendingTimers.timeouts.clear();
    };
  }, []);

  useEffect(() => {
    if (!layout) return;

    const currentIds = new Set(layout.positions.keys());
    const previousIds = prevVisibleIdsRef.current;
    const framePositions = prevPositionsRef.current;

    const removedIds = Array.from(previousIds).filter(
      (id) => !currentIds.has(id),
    );
    const addedIds = Array.from(currentIds).filter(
      (id) => !previousIds.has(id),
    );

    // 消えていく途中のノードの収束先を更新する。
    // 閉じた直後の1フレーム目はまだ実測高さが揺れていて親の位置が暫定値のことがあるため、
    // 新規に消えたノードだけでなく、フェード中の既存ノードもレイアウトが変わるたびに
    // 収束先を追従・補正し続ける（最終的に親の落ち着き先へ正しく吸い込まれる）。
    // ※ refの更新はsetStateの更新関数の外（このeffect本体）で行い、更新関数自体は
    //   Reactが期待する「副作用を持たない」ものに保つ。
    if (removedIds.length > 0 || prevExitingNodesRef.current.size > 0) {
      const next = new Map(prevExitingNodesRef.current);

      removedIds.forEach((id) => {
        // 生き残っている祖先（＝閉じたノード自身）の現在位置に向けて吸い込む。
        // 見つからない場合は消える直前の位置に留めてフェードのみ行う。
        const pos =
          findConvergenceTarget(id, parentOf, layout.positions) ??
          framePositions.get(id);
        if (pos) next.set(id, pos);
      });

      next.forEach((_, id) => {
        const pos = findConvergenceTarget(id, parentOf, layout.positions);
        if (pos) next.set(id, pos);
      });

      prevExitingNodesRef.current = next;
      setExitingNodes(next);
    }

    if (removedIds.length > 0) {
      const timeoutId = window.setTimeout(() => {
        pendingTimersRef.current.timeouts.delete(timeoutId);

        if (removedIds.every((id) => !prevExitingNodesRef.current.has(id))) {
          return;
        }

        const next = new Map(prevExitingNodesRef.current);
        removedIds.forEach((id) => next.delete(id));
        prevExitingNodesRef.current = next;
        setExitingNodes(next);
      }, EXIT_TRANSITION_MS);

      pendingTimersRef.current.timeouts.add(timeoutId);
    }

    if (addedIds.length > 0) {
      setEnteringNodes((prev) => {
        const next = new Map(prev);
        addedIds.forEach((id) => {
          const parentId = parentOf.get(id);
          const spawnPos =
            (parentId ? framePositions.get(parentId) : undefined) ??
            layout.positions.get(id) ??
            null;
          if (spawnPos) next.set(id, spawnPos);
        });
        return next;
      });

      // ブラウザが「出発位置」を一度描画してから最終位置へ切り替える
      // （1回のrAFだと描画前に上書きされることがあるため2段構えにする）
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!isMountedRef.current) return;

          setEnteringNodes((prev) => {
            if (addedIds.every((id) => !prev.has(id))) return prev;
            const next = new Map(prev);
            addedIds.forEach((id) => next.delete(id));
            return next;
          });
        });
      });
    }

    prevVisibleIdsRef.current = currentIds;
    prevPositionsRef.current = layout.positions;
  }, [layout, parentOf]);

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
                root={root}
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
                        isExpanded={!collapsedSet.has(node.id)}
                        onToggleExpand={() => toggleNodeExpanded(node.id)}
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

// 変化が無くなってからこのフレーム数だけ様子を見てポーリングを止める
// （CSSトランジション中は座標が毎フレーム変わるため自動的に動き続け、
//  静止したことが分かったら止まる＝アイドル時にCPUを使い続けない）
const CONNECTOR_IDLE_FRAMES = 8;

const round1 = (value: number) => Math.round(value * 10) / 10;

function ConnectionsOverlay({
  root,
  columns,
  zoom,
  layout,
}: {
  root: TaskNode;
  columns: TreeColumn[];
  zoom: number;
  layout: TreeLayout | null;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([]);

  useEffect(() => {
    let animationFrameId = 0;
    let idleFrameCount = 0;
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
      // （開いている列はすべて自分のparentIdを持つため、列ごとに一律で処理できる）
      const links: { parentId: string; childId: string }[] = columns.flatMap(
        (column) =>
          column.nodes.map((node) => ({
            parentId: column.parentId,
            childId: node.id,
          })),
      );

      links.forEach((link) => {
        const parentElement = document.getElementById(`node-${link.parentId}`);
        const childElement = document.getElementById(`node-${link.childId}`);

        if (!parentElement || !childElement) return;

        const parentRect = parentElement.getBoundingClientRect();
        const childRect = childElement.getBoundingClientRect();

        // 実測値はズームで拡縮された画面上の座標なので、論理座標に戻す。
        // 小数点以下を丸めて、サブピクセルのブレで「変化した」と誤検知しないようにする。
        // 親の右端中央
        const startX = round1((parentRect.right - svgRect.left) / zoom);
        const startY = round1(
          (parentRect.top + parentRect.height / 2 - svgRect.top) / zoom,
        );

        // 子の左端中央
        const endX = round1((childRect.left - svgRect.left) / zoom);
        const endY = round1(
          (childRect.top + childRect.height / 2 - svgRect.top) / zoom,
        );

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

      if (changed) {
        idleFrameCount = 0;
      } else {
        idleFrameCount += 1;
      }

      // 一定フレーム変化がなければ一時停止する。
      // ノードの開閉・実測高さの確定・ズーム変更などpositionsが変わりうる操作は
      // すべてlayoutの再計算を経由するため、依存配列のlayoutが変わればeffectごと再始動する。
      if (idleFrameCount < CONNECTOR_IDLE_FRAMES) {
        animationFrameId = requestAnimationFrame(updateLines);
      }
    };

    animationFrameId = requestAnimationFrame(updateLines);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [root, columns, zoom, layout]);

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
          stroke="var(--text-primary)"
          strokeWidth="2"
          strokeOpacity="0.5"
        />
      ))}
    </svg>
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
