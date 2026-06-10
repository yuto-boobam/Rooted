import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@supabase/supabase-js';
import type { Project, TaskNode, View } from './types';
import { supabase } from './utils/supabaseClient';
import { PROJECT_COLORS, PROJECT_ICONS } from './types';

// ── ヘルパー関数 ────────────────────────────────────────────────────────────

/** ユニークなIDを生成する */
export const makeId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

/** 新しいタスクノードを作成する */
export const makeNode = (title = '新しいタスク', memo = ''): TaskNode => ({
  id: makeId(),
  title,
  memo,
  completed: false,
  progress: 0,
  children: [],
});

/** 新しいプロジェクトを作成する（ランダムな色とアイコンを割り当て） */
const makeProject = (title: string, description: string): Project => {
  const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
  const icon = PROJECT_ICONS[Math.floor(Math.random() * PROJECT_ICONS.length)];
  return {
    id: makeId(),
    title,
    description,
    icon,
    color,
    starred: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: 0,
    rootTask: makeNode(title),
  };
};

// ── ツリー操作ヘルパー ────────────────────────────────────────────────────

/**
 * ツリーを再帰的に走査し、指定IDのノードを fn で変換した新しいツリーを返す。
 * イミュータブルな更新のため、常に新しいオブジェクトを返す。
 */
function mapNode(
  node: TaskNode,
  targetId: string,
  fn: (n: TaskNode) => TaskNode
): TaskNode {
  if (node.id === targetId) return fn(node);
  return { ...node, children: node.children.map((c) => mapNode(c, targetId, fn)) };
}

/** 指定IDのノードを検索して返す */
function findNode(node: TaskNode, targetId: string): TaskNode | null {
  if (node.id === targetId) return node;
  for (const child of node.children) {
    const found = findNode(child, targetId);
    if (found) return found;
  }
  return null;
}

/**
 * 指定IDのノードの「親ノード」と「親の中でのインデックス」を返す。
 * ルートノードには親がないため null を返す。
 */
function findParent(
  node: TaskNode,
  targetId: string
): { parent: TaskNode; index: number } | null {
  const idx = node.children.findIndex((c) => c.id === targetId);
  if (idx !== -1) return { parent: node, index: idx };
  for (const child of node.children) {
    const result = findParent(child, targetId);
    if (result) return result;
  }
  return null;
}

/** 指定IDのノードをツリーから削除した新しいツリーを返す */
function removeNode(root: TaskNode, targetId: string): TaskNode {
  return {
    ...root,
    children: root.children
      .filter((c) => c.id !== targetId)
      .map((c) => removeNode(c, targetId)),
  };
}

/** ルートから targetId までのIDパスを返す。見つからなければ null */
function buildPath(node: TaskNode, targetId: string, path: string[] = []): string[] | null {
  if (node.id === targetId) return [...path, node.id];
  for (const child of node.children) {
    const result = buildPath(child, targetId, [...path, node.id]);
    if (result) return result;
  }
  return null;
}

// ── Zustand ストアの型定義 ────────────────────────────────────────────────

type AppState = {
  user: User | null;
  setUser: (user: User | null) => void;
  nickname: string;
  setNickname: (nickname: string) => Promise<void>;
  projects: Project[];
  view: View;
  currentProjectId: string | null;
  /**
   * selectedPath: ルートから現在選択中ノードまでのIDの配列。
   * 例: [rootId, nodeA_id, nodeB_id]
   * これをもとに列ビューを生成する。
   */
  selectedPath: string[];

  // プロジェクト操作
  addProject: (title: string, description: string) => void;
  deleteProject: (id: string) => void;
  toggleStar: (id: string) => void;
  openProject: (id: string) => void;
  goToDashboard: () => void;

  // ノード操作
  addChildNode: (projectId: string, parentId: string, title?: string, memo?: string) => string;
  addSiblingNode: (projectId: string, nodeId: string, title?: string, memo?: string) => string;
  deleteNode: (projectId: string, nodeId: string) => void;
  toggleComplete: (projectId: string, nodeId: string) => void;
  updateNodeTitle: (projectId: string, nodeId: string, title: string) => void;
  updateNodeMemo: (projectId: string, nodeId: string, memo: string) => void;
  reorderNodes: (
    projectId: string,
    parentId: string,
    fromIndex: number,
    toIndex: number
  ) => void;
  moveNode: (
    projectId: string,
    nodeId: string,
    targetParentId: string,
    toIndex?: number
  ) => void;

  // 進捗更新（更新ボタン用）
  refreshProgress: () => void;

  // ナビゲーション
  selectNode: (nodeId: string) => void;
  navigateToPath: (path: string[]) => void;
};

// ── ストア本体 ─────────────────────────────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => {
        const nickname = (user?.user_metadata?.nickname as string) ?? '';
        set({ user, nickname });
      },
      nickname: '',
      setNickname: async (nickname) => {
        const { error } = await supabase.auth.updateUser({
          data: { nickname },
        });
        if (error) {
          console.error('ニックネームの更新に失敗しました:', error.message);
          throw error;
        }
        set({ nickname });
      },
      projects: [],
      view: 'dashboard',
      currentProjectId: null,
      selectedPath: [],

      // ──── プロジェクト操作 ────────────────────────────────────────────

      addProject: (title, description) => {
        const project = makeProject(title, description);
        set((s) => ({ projects: [...s.projects, project] }));
      },

      deleteProject: (id) => {
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          // 現在開いているプロジェクトを削除した場合はダッシュボードへ
          view: s.currentProjectId === id ? 'dashboard' : s.view,
          currentProjectId: s.currentProjectId === id ? null : s.currentProjectId,
        }));
      },

      toggleStar: (id) => {
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, starred: !p.starred } : p
          ),
        }));
      },

      openProject: (id) => {
        const project = get().projects.find((p) => p.id === id);
        if (!project) return;
        set({
          view: 'tree',
          currentProjectId: id,
          selectedPath: [project.rootTask.id],
        });
      },

      goToDashboard: () => {
        set({ view: 'dashboard', currentProjectId: null, selectedPath: [] });
      },

      // ──── ノード操作 ─────────────────────────────────────────────────

      addChildNode: (projectId, parentId, title?, memo?) => {
        const newNode = makeNode(title, memo);
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const newRoot = mapNode(p.rootTask, parentId, (n) => ({
              ...n,
              children: [...n.children, newNode],
            }));
            return { ...p, rootTask: newRoot, updatedAt: new Date().toISOString() };
          }),
        }));
        return newNode.id;
      },

      addSiblingNode: (projectId, nodeId, title?, memo?) => {
        const newNode = makeNode(title, memo);
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            // ルートノードには兄弟を追加できない
            if (p.rootTask.id === nodeId) return p;
            const parentInfo = findParent(p.rootTask, nodeId);
            if (!parentInfo) return p;
            const { parent, index } = parentInfo;
            const newRoot = mapNode(p.rootTask, parent.id, (n) => {
              const newChildren = [...n.children];
              newChildren.splice(index + 1, 0, newNode);
              return { ...n, children: newChildren };
            });
            return { ...p, rootTask: newRoot, updatedAt: new Date().toISOString() };
          }),
        }));
        return newNode.id;
      },

      deleteNode: (projectId, nodeId) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            // ルートノードは削除不可
            if (p.rootTask.id === nodeId) return p;
            const newRoot = removeNode(p.rootTask, nodeId);
            return { ...p, rootTask: newRoot, updatedAt: new Date().toISOString() };
          }),
          // 削除されたノードが selectedPath に含まれていたら、そのノード以降を切り捨て
          selectedPath: s.selectedPath.includes(nodeId)
            ? s.selectedPath.slice(0, s.selectedPath.indexOf(nodeId))
            : s.selectedPath,
        }));
      },

      toggleComplete: (projectId, nodeId) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const newRoot = mapNode(p.rootTask, nodeId, (n) => ({
              ...n,
              completed: !n.completed,
            }));
            return { ...p, rootTask: newRoot, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      updateNodeTitle: (projectId, nodeId, title) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const newRoot = mapNode(p.rootTask, nodeId, (n) => ({ ...n, title }));
            return { ...p, rootTask: newRoot, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      updateNodeMemo: (projectId, nodeId, memo) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const newRoot = mapNode(p.rootTask, nodeId, (n) => ({ ...n, memo }));
            return { ...p, rootTask: newRoot, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      reorderNodes: (projectId, parentId, fromIndex, toIndex) => {
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== projectId) return p;
            const newRoot = mapNode(p.rootTask, parentId, (n) => {
              const children = [...n.children];
              const [moved] = children.splice(fromIndex, 1);
              children.splice(toIndex, 0, moved);
              return { ...n, children };
            });
            return { ...p, rootTask: newRoot, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      moveNode: (projectId, nodeId, targetParentId, toIndex) => {
        set((s) => {
          const project = s.projects.find((p) => p.id === projectId);
          if (!project) return s;
          if (project.rootTask.id === nodeId) return s; // ルートは移動不可

          const draggedNode = findNode(project.rootTask, nodeId);
          if (!draggedNode) return s;

          const draggedParentInfo = findParent(project.rootTask, nodeId);
          const isSameParent = draggedParentInfo && draggedParentInfo.parent.id === targetParentId;
          const oldIndex = draggedParentInfo ? draggedParentInfo.index : -1;

          // 循環参照チェック: ターゲット親が自分自身、または自分の子孫であれば移動不可
          const checkCyclic = (n: TaskNode): boolean => {
            if (n.id === targetParentId) return true;
            return n.children.some(checkCyclic);
          };
          if (checkCyclic(draggedNode)) return s;

          const targetParent = findNode(project.rootTask, targetParentId);
          if (!targetParent) return s;

          // 元の親から削除
          let newRoot = removeNode(project.rootTask, nodeId);

          // 新しい親に追加
          newRoot = mapNode(newRoot, targetParentId, (n) => {
            const newChildren = [...n.children];
            if (toIndex !== undefined) {
              let insertIndex = toIndex;
              if (isSameParent && oldIndex !== -1 && oldIndex < insertIndex) {
                insertIndex -= 1;
              }
              newChildren.splice(insertIndex, 0, draggedNode);
            } else {
              newChildren.push(draggedNode);
            }
            return { ...n, children: newChildren };
          });

          const newProjects = s.projects.map((p) =>
            p.id === projectId
              ? { ...p, rootTask: newRoot, updatedAt: new Date().toISOString() }
              : p
          );

          // 移動によって selectedPath が切断された場合、再構築する
          let newSelectedPath = s.selectedPath;
          if (s.currentProjectId === projectId && s.selectedPath.length > 0) {
            const currentSelectedId = s.selectedPath[s.selectedPath.length - 1];
            const rebuiltPath = buildPath(newRoot, currentSelectedId);
            newSelectedPath = rebuiltPath || [newRoot.id];
          }

          return { ...s, projects: newProjects, selectedPath: newSelectedPath };
        });
      },

      // ──── 進捗更新 ────────────────────────────────────────────────────

      refreshProgress: () => {
        /** ノードのprogressを再帰的に計算してツリーを再構成する */
        function recalcNode(node: TaskNode): TaskNode {
          if (node.children.length === 0) {
            return { ...node, progress: node.completed ? 100 : 0 };
          }
          const recalcedChildren = node.children.map(recalcNode);
          const avg =
            recalcedChildren.reduce((sum, c) => sum + c.progress, 0) /
            recalcedChildren.length;
          return { ...node, children: recalcedChildren, progress: Math.round(avg) };
        }

        set((s) => ({
          projects: s.projects.map((p) => {
            const newRoot = recalcNode(p.rootTask);
            return {
              ...p,
              rootTask: newRoot,
              progress: newRoot.progress,
            };
          }),
        }));
      },

      // ──── ナビゲーション ──────────────────────────────────────────────

      selectNode: (nodeId) => {
        const { projects, currentProjectId } = get();
        const project = projects.find((p) => p.id === currentProjectId);
        if (!project) return;
        const path = buildPath(project.rootTask, nodeId);
        if (path) set({ selectedPath: path });
      },

      navigateToPath: (path) => {
        set({ selectedPath: path });
      },
    }),
    {
      name: 'rooted-storage', // localStorage のキー名
      partialize: (state) => ({
        projects: state.projects,
        view: state.view,
        currentProjectId: state.currentProjectId,
        selectedPath: state.selectedPath,
      }),
    }

  )
);
