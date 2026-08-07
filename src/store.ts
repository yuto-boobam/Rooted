// src/store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@supabase/supabase-js';
import type {
  CalendarViewMode,
  Project,
  RightPanelState,
  TaskNode,
  View,
} from './types';
import { PROJECT_COLORS, PROJECT_ICONS } from './types';
import { supabase } from './utils/supabaseClient';
import { getDueUrgencyColors } from './utils/dueDateColor';
import {
  GUEST_SAMPLE_PROJECT_ID,
  makeGuestSampleProject,
} from './data/guestSampleProject';

// ── UI用定数 ─────────────────────────────────────────────────────────────

export const PRIORITY_TASK_BORDER_COLOR = '#fb7185';

const DEFAULT_RIGHT_PANEL_STATE: RightPanelState = {
  isOpen: false,
  isTodayDueOpen: true,
  isPriorityListOpen: true,
  isCalendarOpen: true,
  calendarMode: 'weekly',
};

export type RightPanelSectionKey =
  | 'isTodayDueOpen'
  | 'isPriorityListOpen'
  | 'isCalendarOpen';

const completionTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── ヘルパー関数 ────────────────────────────────────────────────────────────

export const makeId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2);

export function todayDateKey(): string {
  return toDateKey(new Date());
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isDateKey(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeDateKey(value: string | null | undefined): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  return isDateKey(trimmed) ? trimmed : null;
}

/**
 * 達成日用の正規化。過去に記録されていたISO日時形式（例: 2026-08-06T09:22:10.329Z）も
 * 日付部分だけを取り出して YYYY-MM-DD に変換する（移行互換用）。
 */
function normalizeCompletedAtDateKey(
  value: string | null | undefined,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (isDateKey(trimmed)) return trimmed;

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;

  return toDateKey(parsed);
}

function dateKeyToTime(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day).getTime();
}

function daysFromToday(dateKey: string): number {
  const today = dateKeyToTime(todayDateKey());
  const target = dateKeyToTime(dateKey);
  return Math.floor((target - today) / (24 * 60 * 60 * 1000));
}

function getDueBackgroundColor(
  dueDate: string | null,
  completed: boolean,
): string | null {
  if (!dueDate || completed) return null;

  const diff = daysFromToday(dueDate);
  return getDueUrgencyColors(diff)?.background ?? null;
}

function clampProgress(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function normalizePriorityOrder(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value <= 0) return null;
  return Math.floor(value);
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * 新しいタスクノードを作成する
 *
 * detailMemo / dueDate / isPriority を追加。
 * priorityOrder はここでは決めず、prepareRoot() 内の normalizePriorityOrders() で採番する。
 */
export const makeNode = (
  title = '新しいタスク',
  memo = '',
  createdBy = '',
  detailMemo = '',
  dueDate: string | null = null,
  isPriority = false,
): TaskNode => {
  const normalizedDueDate = normalizeDateKey(dueDate);
  const normalizedTitle = title.trim() || '新しいタスク';

  return {
    id: makeId(),
    title: normalizedTitle,
    memo,
    detailMemo,
    completed: false,
    progress: 0,

    isPriority,
    priorityOrder: null,

    dueDate: normalizedDueDate,
    backgroundColor: getDueBackgroundColor(normalizedDueDate, false),

    createdBy,
    createdAt: new Date().toISOString(),
    completedAt: null,

    children: [],
  };
};

/** 新しいプロジェクトを作成する */
const makeProject = (
  title: string,
  description: string,
  createdBy: string,
): Project => {
  const color = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
  const icon = PROJECT_ICONS[Math.floor(Math.random() * PROJECT_ICONS.length)];

  return {
    id: makeId(),
    title,
    description,
    icon,
    color,
    starred: false,
    createdBy,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: 0,
    rootTask: makeNode(title, '', createdBy),
  };
};

// ── ツリー操作ヘルパー ────────────────────────────────────────────────────

function mapNode(
  node: TaskNode,
  targetId: string,
  fn: (n: TaskNode) => TaskNode,
): TaskNode {
  if (node.id === targetId) return fn(node);

  return {
    ...node,
    children: node.children.map((child) => mapNode(child, targetId, fn)),
  };
}

function mapEveryNode(
  node: TaskNode,
  fn: (n: TaskNode) => TaskNode,
): TaskNode {
  const children = node.children.map((child) => mapEveryNode(child, fn));
  return fn({ ...node, children });
}

function findNode(node: TaskNode, targetId: string): TaskNode | null {
  if (node.id === targetId) return node;

  for (const child of node.children) {
    const found = findNode(child, targetId);
    if (found) return found;
  }

  return null;
}

function findParent(
  node: TaskNode,
  targetId: string,
): { parent: TaskNode; index: number } | null {
  const index = node.children.findIndex((child) => child.id === targetId);
  if (index !== -1) return { parent: node, index };

  for (const child of node.children) {
    const result = findParent(child, targetId);
    if (result) return result;
  }

  return null;
}

function removeNode(root: TaskNode, targetId: string): TaskNode {
  return {
    ...root,
    children: root.children
      .filter((child) => child.id !== targetId)
      .map((child) => removeNode(child, targetId)),
  };
}

function buildPath(
  node: TaskNode,
  targetId: string,
  path: string[] = [],
): string[] | null {
  if (node.id === targetId) return [...path, node.id];

  for (const child of node.children) {
    const result = buildPath(child, targetId, [...path, node.id]);
    if (result) return result;
  }

  return null;
}

function collectNodes(node: TaskNode, result: TaskNode[] = []): TaskNode[] {
  result.push(node);
  node.children.forEach((child) => collectNodes(child, result));
  return result;
}

function refreshDueVisuals(root: TaskNode): TaskNode {
  return mapEveryNode(root, (node) => ({
    ...node,
    backgroundColor: getDueBackgroundColor(node.dueDate, node.completed),
  }));
}

function normalizePriorityOrders(root: TaskNode): TaskNode {
  const priorityNodes = collectNodes(root)
    .filter((node) => node.isPriority && !node.completed)
    .sort((a, b) => {
      const orderA = a.priorityOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.priorityOrder ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.createdAt.localeCompare(b.createdAt);
    });

  const orderMap = new Map<string, number>();

  priorityNodes.forEach((node, index) => {
    orderMap.set(node.id, index + 1);
  });

  return mapEveryNode(root, (node) => {
    const priorityOrder = orderMap.get(node.id) ?? null;
    const isPriority = priorityOrder !== null;

    return {
      ...node,
      isPriority,
      priorityOrder,
    };
  });
}

function applyPriorityOrder(root: TaskNode, orderedIds: string[]): TaskNode {
  const currentPriorityIds = collectNodes(root)
    .filter((node) => node.isPriority && !node.completed)
    .sort((a, b) => {
      const orderA = a.priorityOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.priorityOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    })
    .map((node) => node.id);

  const uniqueRequestedIds = orderedIds.filter(
    (id, index, array) => array.indexOf(id) === index,
  );

  const finalIds = [
    ...uniqueRequestedIds.filter((id) => currentPriorityIds.includes(id)),
    ...currentPriorityIds.filter((id) => !uniqueRequestedIds.includes(id)),
  ];

  const orderMap = new Map<string, number>();

  finalIds.forEach((id, index) => {
    orderMap.set(id, index + 1);
  });

  return mapEveryNode(root, (node) => {
    if (!node.isPriority || node.completed) {
      return {
        ...node,
        isPriority: false,
        priorityOrder: null,
      };
    }

    const priorityOrder = orderMap.get(node.id) ?? null;

    return {
      ...node,
      isPriority: priorityOrder !== null,
      priorityOrder,
    };
  });
}

function movePriorityInRoot(
  root: TaskNode,
  nodeId: string,
  direction: 'up' | 'down',
): TaskNode {
  const priorityIds = collectNodes(root)
    .filter((node) => node.isPriority && !node.completed)
    .sort((a, b) => {
      const orderA = a.priorityOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.priorityOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    })
    .map((node) => node.id);

  const index = priorityIds.indexOf(nodeId);
  if (index === -1) return root;

  const nextIndex = direction === 'up' ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= priorityIds.length) return root;

  const nextIds = [...priorityIds];
  [nextIds[index], nextIds[nextIndex]] = [nextIds[nextIndex], nextIds[index]];

  return applyPriorityOrder(root, nextIds);
}

function reorderPriorityInRoot(
  root: TaskNode,
  activeNodeId: string,
  overNodeId: string,
): TaskNode {
  if (activeNodeId === overNodeId) return root;

  const priorityIds = collectNodes(root)
    .filter((node) => node.isPriority && !node.completed)
    .sort((a, b) => {
      const orderA = a.priorityOrder ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.priorityOrder ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    })
    .map((node) => node.id);

  const activeIndex = priorityIds.indexOf(activeNodeId);
  const overIndex = priorityIds.indexOf(overNodeId);

  if (activeIndex === -1 || overIndex === -1) return root;

  const nextIds = [...priorityIds];
  const [moved] = nextIds.splice(activeIndex, 1);
  nextIds.splice(overIndex, 0, moved);

  return applyPriorityOrder(root, nextIds);
}

function recalcProgress(root: TaskNode): TaskNode {
  const children = root.children.map(recalcProgress);

  // 子タスクを持たないノード（leaf）は達成状態を手動管理する
  if (children.length === 0) {
    return {
      ...root,
      children,
      progress: root.completed ? 100 : 0,
    };
  }

  // 親ノードは子タスクの達成率から自動的に導出する（手動チェック不可）
  const average = Math.round(
    children.reduce((sum, child) => sum + child.progress, 0) / children.length,
  );
  const completed = average === 100;

  return {
    ...root,
    children,
    progress: average,
    completed,
    completedAt: completed
      ? (root.completed ? root.completedAt : todayDateKey())
      : null,
    isPriority: completed ? false : root.isPriority,
    priorityOrder: completed ? null : root.priorityOrder,
  };
}

function prepareRoot(root: TaskNode): TaskNode {
  return refreshDueVisuals(normalizePriorityOrders(recalcProgress(root)));
}

function updateProjectRoot(project: Project, rootTask: TaskNode): Project {
  const nextRoot = prepareRoot(rootTask);

  return {
    ...project,
    rootTask: nextRoot,
    progress: nextRoot.progress,
    updatedAt: new Date().toISOString(),
  };
}

// ── persist 互換用ノーマライズ ────────────────────────────────────────────

function normalizeTaskNode(
  node: Partial<TaskNode>,
  fallbackCreatedBy = '',
): TaskNode {
  const completed = Boolean(node.completed);
  const dueDate = normalizeDateKey(node.dueDate);
  const createdBy = safeString(node.createdBy, fallbackCreatedBy);
  const normalizedPriorityOrder = normalizePriorityOrder(node.priorityOrder);

  const isPriority =
    !completed && (Boolean(node.isPriority) || normalizedPriorityOrder !== null);

  return {
    id: safeString(node.id, makeId()),
    title: safeString(node.title, '新しいタスク'),
    memo: safeString(node.memo, ''),
    detailMemo: safeString(node.detailMemo, ''),

    completed,
    progress: clampProgress(node.progress),

    isPriority,
    priorityOrder: completed ? null : normalizedPriorityOrder,

    dueDate,
    backgroundColor: getDueBackgroundColor(dueDate, completed),

    createdBy,
    createdAt: safeString(node.createdAt, new Date().toISOString()),
    completedAt: completed
      ? normalizeCompletedAtDateKey(node.completedAt)
      : null,

    children: Array.isArray(node.children)
      ? node.children.map((child) => normalizeTaskNode(child, createdBy))
      : [],
  };
}

function normalizeProject(project: Partial<Project>): Project {
  const createdBy = safeString(project.createdBy, '');
  const title = safeString(project.title, '無題のプロジェクト');

  const rootTask = project.rootTask
    ? normalizeTaskNode(project.rootTask, createdBy)
    : makeNode(title, '', createdBy);

  const preparedRoot = prepareRoot(rootTask);

  return {
    id: safeString(project.id, makeId()),
    title,
    description: safeString(project.description, ''),
    icon: safeString(project.icon, PROJECT_ICONS[0]),
    color: safeString(project.color, PROJECT_COLORS[0]),
    starred: Boolean(project.starred),
    createdBy,
    createdAt: safeString(project.createdAt, new Date().toISOString()),
    updatedAt: safeString(project.updatedAt, new Date().toISOString()),
    progress: preparedRoot.progress,
    rootTask: preparedRoot,
  };
}

function normalizeRightPanelState(value: unknown): RightPanelState {
  const partial =
    value && typeof value === 'object'
      ? (value as Partial<RightPanelState>)
      : {};

  return {
    isOpen: false,
    isTodayDueOpen:
      typeof partial.isTodayDueOpen === 'boolean'
        ? partial.isTodayDueOpen
        : DEFAULT_RIGHT_PANEL_STATE.isTodayDueOpen,
    isPriorityListOpen:
      typeof partial.isPriorityListOpen === 'boolean'
        ? partial.isPriorityListOpen
        : DEFAULT_RIGHT_PANEL_STATE.isPriorityListOpen,
    isCalendarOpen:
      typeof partial.isCalendarOpen === 'boolean'
        ? partial.isCalendarOpen
        : DEFAULT_RIGHT_PANEL_STATE.isCalendarOpen,
    calendarMode: partial.calendarMode === 'monthly' ? 'monthly' : 'weekly',
  };
}

// ── Zustand ストア型 ───────────────────────────────────────────────────────

export type AppState = {
  user: User | null;
  setUser: (user: User | null) => void;

  // ゲストモード（Supabase認証を経由しないお試しログイン）
  isGuest: boolean;
  enterGuestMode: () => void;
  logout: () => Promise<void>;

  nickname: string;
  setNickname: (nickname: string) => Promise<void>;

  // 配色テーマ（ライト/ダーク）
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  projects: Project[];
  view: View;
  currentProjectId: string | null;
  selectedPath: string[];

  // ノードごとの開閉状態（ここに含まれるノードIDは「閉じている」。未登録なら開いている扱い）
  collapsedNodeIds: string[];
  toggleNodeExpanded: (nodeId: string) => void;

  // プロジェクト操作
  addProject: (title: string, description: string) => void;
  deleteProject: (id: string) => void;
  importProject: (project: Partial<Project>) => void;
  toggleStar: (id: string) => void;
  openProject: (id: string) => void;
  goToDashboard: () => void;

  // ノード操作
  addChildNode: (
    projectId: string,
    parentId: string,
    title?: string,
    memo?: string,
    detailMemo?: string,
    dueDate?: string | null,
    isPriority?: boolean,
  ) => string;

  addSiblingNode: (
    projectId: string,
    nodeId: string,
    title?: string,
    memo?: string,
    detailMemo?: string,
    dueDate?: string | null,
    isPriority?: boolean,
  ) => string;

  deleteNode: (projectId: string, nodeId: string) => void;
  toggleComplete: (projectId: string, nodeId: string) => void;

  setNodeCompletion: (
    projectId: string,
    nodeId: string,
    completed: boolean,
  ) => void;

  completeNodeAfterDelay: (
    projectId: string,
    nodeId: string,
    delayMs?: number,
  ) => void;

  updateNodeTitle: (
    projectId: string,
    nodeId: string,
    title: string,
  ) => void;

  updateNodeMemo: (
    projectId: string,
    nodeId: string,
    memo: string,
  ) => void;

  updateNodeDetailMemo: (
    projectId: string,
    nodeId: string,
    detailMemo: string,
  ) => void;

  updateNodeDueDate: (
    projectId: string,
    nodeId: string,
    dueDate: string | null,
  ) => void;

  updateNodeCompletedAt: (
    projectId: string,
    nodeId: string,
    completedAt: string | null,
  ) => void;

  toggleNodePriority: (projectId: string, nodeId: string) => void;

  setNodePriority: (
    projectId: string,
    nodeId: string,
    isPriority: boolean,
  ) => void;

  movePriorityTask: (
    projectId: string,
    nodeId: string,
    direction: 'up' | 'down',
  ) => void;

  reorderPriorityTasks: (
    projectId: string,
    activeNodeId: string,
    overNodeId: string,
  ) => void;

  reorderNodes: (
    projectId: string,
    parentId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;

  moveNode: (
    projectId: string,
    nodeId: string,
    targetParentId: string,
    toIndex?: number,
  ) => void;

  // ナビゲーション
  selectNode: (nodeId: string) => void;
  navigateToPath: (path: string[]) => void;

  // パッチノートモーダル
  isPatchNotesModalOpen: boolean;
  selectedPatchNoteDate: string | null;
  openPatchNotesModal: (date?: string) => void;
  closePatchNotesModal: () => void;
  setSelectedPatchNoteDate: (date: string | null) => void;

  // 右側スライドパネル
  rightPanel: RightPanelState;
  openRightPanel: () => void;
  closeRightPanel: () => void;
  toggleRightPanel: () => void;
  toggleRightPanelSection: (section: RightPanelSectionKey) => void;
  setRightPanelCalendarMode: (mode: CalendarViewMode) => void;
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

      isGuest: false,

      enterGuestMode: () => {
        set({ isGuest: true, user: null, nickname: 'ゲスト' });

        const hasSampleProject = get().projects.some(
          (project) => project.id === GUEST_SAMPLE_PROJECT_ID,
        );
        if (!hasSampleProject) {
          get().importProject(makeGuestSampleProject());
        }
      },

      logout: async () => {
        if (get().isGuest) {
          set({ isGuest: false, user: null, nickname: '' });
          return;
        }
        await supabase.auth.signOut();
      },

      nickname: '',

      setNickname: async (nickname) => {
        if (get().isGuest) {
          set({ nickname });
          return;
        }

        const { error } = await supabase.auth.updateUser({
          data: { nickname },
        });

        if (error) {
          console.error('ニックネームの更新に失敗しました:', error.message);
          throw error;
        }

        set({ nickname });
      },

      theme: 'dark',

      toggleTheme: () => {
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        }));
      },

      projects: [],
      view: 'dashboard',
      currentProjectId: null,
      selectedPath: [],
      collapsedNodeIds: [],

      toggleNodeExpanded: (nodeId) => {
        set((state) => ({
          collapsedNodeIds: state.collapsedNodeIds.includes(nodeId)
            ? state.collapsedNodeIds.filter((id) => id !== nodeId)
            : [...state.collapsedNodeIds, nodeId],
        }));
      },

      // ──── プロジェクト操作 ────────────────────────────────────────────

      addProject: (title, description) => {
        const { nickname } = get();
        const project = makeProject(title, description, nickname);
        set((state) => ({ projects: [...state.projects, project] }));
      },

      deleteProject: (id) => {
        set((state) => ({
          projects: state.projects.filter((project) => project.id !== id),
          view: state.currentProjectId === id ? 'dashboard' : state.view,
          currentProjectId:
            state.currentProjectId === id ? null : state.currentProjectId,
          selectedPath:
            state.currentProjectId === id ? [] : state.selectedPath,
        }));
      },

      importProject: (project) => {
        const normalized = normalizeProject(project);

        set((state) => {
          const existingIndex = state.projects.findIndex(
            (item) => item.id === normalized.id,
          );

          if (existingIndex === -1) {
            return { projects: [...state.projects, normalized] };
          }

          const projects = [...state.projects];
          projects[existingIndex] = normalized;
          return { projects };
        });
      },

      toggleStar: (id) => {
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === id
              ? { ...project, starred: !project.starred }
              : project,
          ),
        }));
      },

      openProject: (id) => {
        const project = get().projects.find((item) => item.id === id);
        if (!project) return;

        set({
          view: 'tree',
          currentProjectId: id,
          selectedPath: [project.rootTask.id],
        });
      },

      goToDashboard: () => {
        set({
          view: 'dashboard',
          currentProjectId: null,
          selectedPath: [],
        });
      },

      // ──── ノード操作 ─────────────────────────────────────────────────

      addChildNode: (
        projectId,
        parentId,
        title,
        memo,
        detailMemo,
        dueDate,
        isPriority,
      ) => {
        const { nickname } = get();

        const newNode = makeNode(
          title,
          memo,
          nickname,
          detailMemo,
          dueDate ?? null,
          Boolean(isPriority),
        );

        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = mapNode(project.rootTask, parentId, (node) => ({
              ...node,
              children: [...node.children, newNode],
            }));

            return updateProjectRoot(project, nextRoot);
          }),
        }));

        return newNode.id;
      },

      addSiblingNode: (
        projectId,
        nodeId,
        title,
        memo,
        detailMemo,
        dueDate,
        isPriority,
      ) => {
        const { nickname } = get();

        const newNode = makeNode(
          title,
          memo,
          nickname,
          detailMemo,
          dueDate ?? null,
          Boolean(isPriority),
        );

        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            if (project.rootTask.id === nodeId) return project;

            const parentInfo = findParent(project.rootTask, nodeId);
            if (!parentInfo) return project;

            const { parent, index } = parentInfo;

            const nextRoot = mapNode(project.rootTask, parent.id, (node) => {
              const children = [...node.children];
              children.splice(index + 1, 0, newNode);

              return {
                ...node,
                children,
              };
            });

            return updateProjectRoot(project, nextRoot);
          }),
        }));

        return newNode.id;
      },

      deleteNode: (projectId, nodeId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            if (project.rootTask.id === nodeId) return project;

            const nextRoot = removeNode(project.rootTask, nodeId);
            return updateProjectRoot(project, nextRoot);
          }),
          selectedPath: state.selectedPath.includes(nodeId)
            ? state.selectedPath.slice(0, state.selectedPath.indexOf(nodeId))
            : state.selectedPath,
          collapsedNodeIds: state.collapsedNodeIds.filter(
            (id) => id !== nodeId,
          ),
        }));
      },

      toggleComplete: (projectId, nodeId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) return;

        const node = findNode(project.rootTask, nodeId);
        if (!node) return;

        get().setNodeCompletion(projectId, nodeId, !node.completed);
      },

      setNodeCompletion: (projectId, nodeId, completed) => {
        const completedAt = completed ? todayDateKey() : null;

        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = mapNode(project.rootTask, nodeId, (node) => ({
              ...node,
              completed,
              progress: completed ? 100 : 0,
              completedAt,
              isPriority: completed ? false : node.isPriority,
              priorityOrder: completed ? null : node.priorityOrder,
            }));

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      completeNodeAfterDelay: (projectId, nodeId, delayMs = 1800) => {
        const timerKey = `${projectId}:${nodeId}`;

        const existingTimer = completionTimers.get(timerKey);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          get().setNodeCompletion(projectId, nodeId, true);
          completionTimers.delete(timerKey);
        }, delayMs);

        completionTimers.set(timerKey, timer);
      },

      updateNodeTitle: (projectId, nodeId, title) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = mapNode(project.rootTask, nodeId, (node) => ({
              ...node,
              title,
            }));

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      updateNodeMemo: (projectId, nodeId, memo) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = mapNode(project.rootTask, nodeId, (node) => ({
              ...node,
              memo,
            }));

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      updateNodeDetailMemo: (projectId, nodeId, detailMemo) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = mapNode(project.rootTask, nodeId, (node) => ({
              ...node,
              detailMemo,
            }));

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      updateNodeDueDate: (projectId, nodeId, dueDate) => {
        const normalizedDueDate = normalizeDateKey(dueDate);

        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = mapNode(project.rootTask, nodeId, (node) => ({
              ...node,
              dueDate: normalizedDueDate,
              backgroundColor: getDueBackgroundColor(
                normalizedDueDate,
                node.completed,
              ),
            }));

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      updateNodeCompletedAt: (projectId, nodeId, completedAt) => {
        const normalizedCompletedAt = normalizeDateKey(completedAt);

        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = mapNode(project.rootTask, nodeId, (node) => ({
              ...node,
              completedAt: normalizedCompletedAt,
            }));

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      toggleNodePriority: (projectId, nodeId) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) return;

        const node = findNode(project.rootTask, nodeId);
        if (!node || node.completed) return;

        get().setNodePriority(projectId, nodeId, !node.isPriority);
      },

      setNodePriority: (projectId, nodeId, isPriority) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const maxOrder = collectNodes(project.rootTask).reduce(
              (max, node) =>
                node.isPriority && node.priorityOrder
                  ? Math.max(max, node.priorityOrder)
                  : max,
              0,
            );

            const nextRoot = mapNode(project.rootTask, nodeId, (node) => {
              if (node.completed) return node;

              return {
                ...node,
                isPriority,
                priorityOrder: isPriority
                  ? node.priorityOrder ?? maxOrder + 1
                  : null,
              };
            });

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      movePriorityTask: (projectId, nodeId, direction) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = movePriorityInRoot(
              project.rootTask,
              nodeId,
              direction,
            );

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      reorderPriorityTasks: (projectId, activeNodeId, overNodeId) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = reorderPriorityInRoot(
              project.rootTask,
              activeNodeId,
              overNodeId,
            );

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      reorderNodes: (projectId, parentId, fromIndex, toIndex) => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;

            const nextRoot = mapNode(project.rootTask, parentId, (node) => {
              const children = [...node.children];
              const [moved] = children.splice(fromIndex, 1);
              if (!moved) return node;

              children.splice(toIndex, 0, moved);

              return {
                ...node,
                children,
              };
            });

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      moveNode: (projectId, nodeId, targetParentId, toIndex) => {
        set((state) => {
          const project = state.projects.find((item) => item.id === projectId);
          if (!project) return state;
          if (project.rootTask.id === nodeId) return state;

          const draggedNode = findNode(project.rootTask, nodeId);
          if (!draggedNode) return state;

          const draggedParentInfo = findParent(project.rootTask, nodeId);
          const isSameParent =
            draggedParentInfo?.parent.id === targetParentId;
          const oldIndex = draggedParentInfo?.index ?? -1;

          const checkCyclic = (node: TaskNode): boolean => {
            if (node.id === targetParentId) return true;
            return node.children.some(checkCyclic);
          };

          if (checkCyclic(draggedNode)) return state;

          const targetParent = findNode(project.rootTask, targetParentId);
          if (!targetParent) return state;

          let nextRoot = removeNode(project.rootTask, nodeId);

          nextRoot = mapNode(nextRoot, targetParentId, (node) => {
            const children = [...node.children];

            if (toIndex !== undefined) {
              let insertIndex = toIndex;

              if (isSameParent && oldIndex !== -1 && oldIndex < insertIndex) {
                insertIndex -= 1;
              }

              children.splice(insertIndex, 0, draggedNode);
            } else {
              children.push(draggedNode);
            }

            return {
              ...node,
              children,
            };
          });

          const updatedProject = updateProjectRoot(project, nextRoot);

          const projects = state.projects.map((item) =>
            item.id === projectId ? updatedProject : item,
          );

          let selectedPath = state.selectedPath;

          if (state.currentProjectId === projectId && selectedPath.length > 0) {
            const currentSelectedId = selectedPath[selectedPath.length - 1];
            const rebuiltPath = buildPath(
              updatedProject.rootTask,
              currentSelectedId,
            );

            selectedPath = rebuiltPath ?? [updatedProject.rootTask.id];
          }

          return {
            ...state,
            projects,
            selectedPath,
          };
        });
      },

      // ──── ナビゲーション ──────────────────────────────────────────────

      selectNode: (nodeId) => {
        const { projects, currentProjectId } = get();
        const project = projects.find((item) => item.id === currentProjectId);
        if (!project) return;

        const path = buildPath(project.rootTask, nodeId);
        if (path) {
          set({ selectedPath: path });
        }
      },

      navigateToPath: (path) => {
        set({ selectedPath: path });
      },

      // ──── パッチノートモーダル ─────────────────────────────────────────

      isPatchNotesModalOpen: false,
      selectedPatchNoteDate: null,

      openPatchNotesModal: (date) => {
        set({
          isPatchNotesModalOpen: true,
          selectedPatchNoteDate: date ?? null,
        });
      },

      closePatchNotesModal: () => {
        set({ isPatchNotesModalOpen: false });
      },

      setSelectedPatchNoteDate: (date) => {
        set({ selectedPatchNoteDate: date });
      },

      // ──── 右側スライドパネル ──────────────────────────────────────────

      rightPanel: DEFAULT_RIGHT_PANEL_STATE,

      openRightPanel: () => {
        set((state) => ({
          rightPanel: {
            ...state.rightPanel,
            isOpen: true,
          },
        }));
      },

      closeRightPanel: () => {
        set((state) => ({
          rightPanel: {
            ...state.rightPanel,
            isOpen: false,
          },
        }));
      },

      toggleRightPanel: () => {
        set((state) => ({
          rightPanel: {
            ...state.rightPanel,
            isOpen: !state.rightPanel.isOpen,
          },
        }));
      },

      toggleRightPanelSection: (section) => {
        set((state) => ({
          rightPanel: {
            ...state.rightPanel,
            [section]: !state.rightPanel[section],
          },
        }));
      },

      setRightPanelCalendarMode: (mode) => {
        set((state) => ({
          rightPanel: {
            ...state.rightPanel,
            calendarMode: mode,
          },
        }));
      },
    }),
    {
      name: 'rooted-storage',

      partialize: (state) => ({
        projects: state.projects,
        view: state.view,
        currentProjectId: state.currentProjectId,
        selectedPath: state.selectedPath,
        collapsedNodeIds: state.collapsedNodeIds,
        theme: state.theme,
        isGuest: state.isGuest,
        rightPanel: {
          ...state.rightPanel,
          isOpen: false,
        },
      }),

      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AppState> | undefined;

        const projects = Array.isArray(persisted?.projects)
          ? persisted.projects.map((project) => normalizeProject(project))
          : currentState.projects;

        return {
          ...currentState,
          ...persisted,
          projects,
          rightPanel: normalizeRightPanelState(persisted?.rightPanel),
          user: currentState.user,
          nickname: persisted?.isGuest ? 'ゲスト' : currentState.nickname,
          isPatchNotesModalOpen: false,
          selectedPatchNoteDate: null,
        };
      },
    },
  ),
);
