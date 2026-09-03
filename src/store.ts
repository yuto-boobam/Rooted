// src/store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@supabase/supabase-js';
import type {
  Project,
  RightPanelState,
  TaskNode,
  View,
} from './types';
import { PROJECT_COLORS, PROJECT_ICONS } from './types';
import { supabase } from './utils/supabaseClient';
import { getDueUrgencyColors } from './utils/dueDateColor';
import {
  SAMPLE_PROJECT_ID,
  TUTORIAL_NODE_ID,
  SAMPLE_DUE_DATE_OFFSETS,
  makeSampleProject,
  makeTutorialNode,
  offsetDateKey,
} from './data/guestSampleProject';
import { BACKUP_PROJECTS } from './data/backupProjects';
import { clearGuestDrawerGuideDone } from './utils/guestTutorialSession';

// ── UI用定数 ─────────────────────────────────────────────────────────────

export const PRIORITY_TASK_BORDER_COLOR = '#fb7185';

// ゲスト向け誘導ガイド第2段(サイドドロワー・パッチノート)の段階。詳細はAppState内のコメント参照
export type DrawerGuideStep =
  | 'idle'
  | 'openDrawer'
  | 'priorityInfo'
  | 'calendarInfo'
  | 'openPatchNotes'
  | 'done';

const DEFAULT_RIGHT_PANEL_STATE: RightPanelState = {
  isOpen: false,
  isTodayDueOpen: true,
  isWeeklyOpen: true,
  isPriorityListOpen: true,
  isCalendarOpen: true,
};

export type RightPanelSectionKey =
  | 'isTodayDueOpen'
  | 'isWeeklyOpen'
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

// コピー機能: サブツリーを丸ごと複製し、ノード自身とすべての子孫に新しいidを振り直す
// （同じクリップボードを複数回貼り付けても id が衝突しないようにするため）。
// resetWorkflowState=true（貼り付け時）は、コピー元の完了状態・優先タスク登録状態を
// 持ち込まず「まだ達成していない新しい作業」として初期化する（priorityOrderはツリー
// 全体で一意な順位のため、そのまま持ち込むと優先的タスク一覧の順位が重複する）。
// resetWorkflowState=false（コピー開始→終了でクリップボードに取り込む時）は単なる
// スナップショットなので id 以外は変更しない
function cloneNodeDeep(
  node: TaskNode,
  resetWorkflowState: boolean,
  createdBy?: string,
): TaskNode {
  return mapEveryNode(node, (n) => ({
    ...n,
    id: makeId(),
    ...(resetWorkflowState
      ? {
          completed: false,
          completedAt: null,
          isPriority: false,
          priorityOrder: null,
          createdBy: createdBy ?? n.createdBy,
          createdAt: new Date().toISOString(),
        }
      : {}),
  }));
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
    createdBy,
    createdAt: safeString(project.createdAt, new Date().toISOString()),
    updatedAt: safeString(project.updatedAt, new Date().toISOString()),
    progress: preparedRoot.progress,
    rootTask: preparedRoot,
  };
}

// 全ユーザー最初からサンプルプロジェクト＋src/data/backups/に置かれたバックアップJSONが
// 存在している仕様のため、プロジェクトが1件もない状態（初回利用時）にだけ差し込む。
// 既存のプロジェクト（他に追加したものを含む）がある場合は何もしない。
// なお、ゲストの画面表示はDashboardPage側でサンプルプロジェクトのみに絞り込んでいるため、
// ここでバックアップ分を一緒に差し込んでもゲストの見え方には影響しない
function seedInitialProjects(projects: Project[]): Project[] {
  if (projects.length > 0) return projects;
  return [makeSampleProject(), ...BACKUP_PROJECTS].map((project) => normalizeProject(project));
}

// サンプルプロジェクトはmakeSampleProject()で1度だけ初回に差し込まれ、以後は既存の
// localStorageの内容がそのまま使われる(ユーザーが行った編集を上書きしないため)。
// そのため、この機能を追加する以前からlocalStorageにサンプルプロジェクトを持っていた
// ユーザー(過去にゲストログイン済みのブラウザ等)には、サンプルの内容を更新しても
// 自動的には反映されない。「操作方法」ノードのように後から追加した固定ノードは、
// 無ければ末尾に補完する形で個別にマイグレーションする。
//
// 期限については、通常のプロジェクト(インポートしたJSONの期限をそのまま使う)とは
// 扱いを分け、サンプルプロジェクトの期限だけは「サイトを開いた日」から計算し直す
// 仕様にした(ユーザー指定)。そのため下のensureSampleProjectFreshで、無ければ足す
// だけの「操作方法」ノードとは違い、期限は毎回無条件で今日基準の値に上書きする
function resyncSampleDueDates(rootTask: TaskNode): TaskNode {
  return mapEveryNode(rootTask, (node) => {
    const offsetDays = SAMPLE_DUE_DATE_OFFSETS[node.id];
    if (offsetDays === undefined) return node;

    const dueDate = offsetDateKey(offsetDays);
    return {
      ...node,
      dueDate,
      backgroundColor: getDueBackgroundColor(dueDate, node.completed),
    };
  });
}

function ensureSampleProjectFresh(project: Project): Project {
  if (project.id !== SAMPLE_PROJECT_ID) return project;

  const alreadyHasTutorialNode = project.rootTask.children.some(
    (child) => child.id === TUTORIAL_NODE_ID,
  );

  const rootTaskWithTutorialNode = alreadyHasTutorialNode
    ? project.rootTask
    : {
        ...project.rootTask,
        children: [
          ...project.rootTask.children,
          normalizeTaskNode(makeTutorialNode(), project.rootTask.createdBy),
        ],
      };

  const rootTaskWithFreshDueDates = resyncSampleDueDates(rootTaskWithTutorialNode);

  return updateProjectRoot(project, rootTaskWithFreshDueDates);
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
    isWeeklyOpen:
      typeof partial.isWeeklyOpen === 'boolean'
        ? partial.isWeeklyOpen
        : DEFAULT_RIGHT_PANEL_STATE.isWeeklyOpen,
    isPriorityListOpen:
      typeof partial.isPriorityListOpen === 'boolean'
        ? partial.isPriorityListOpen
        : DEFAULT_RIGHT_PANEL_STATE.isPriorityListOpen,
    isCalendarOpen:
      typeof partial.isCalendarOpen === 'boolean'
        ? partial.isCalendarOpen
        : DEFAULT_RIGHT_PANEL_STATE.isCalendarOpen,
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

  // サンプルプロジェクトの「操作方法」ノードを初期状態(子なし)へ丸ごと差し替え、
  // 誘導ガイドを最初からやり直せるようにする(TreePage.tsxの誘導は専用フラグを
  // 持たずツリーの実際の状態から導出しているため、ノードを初期状態へ戻すだけで良い)
  resetSampleTutorial: () => void;

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

  // ──── コピー機能（複数ノードを選択→複製→別ノードへ貼り付け） ──────────────
  // isCopyModeActive中はツリー上のクリックがノード選択トグルに切り替わり、ドロワーは
  // 強制的に閉じる。ドロワーが閉じている間の唯一の操作口として、常時表示の
  // Header.tsx外部ボタンが「コピー終了」ボタンに切り替わる。
  // copiedNodesは貼り付けても消費されず、次にstartCopyModeが呼ばれるまで保持される
  // （同じ内容を何度でもドラッグ&ドロップで貼り付けられるようにするため）
  isCopyModeActive: boolean;
  copySelectionIds: string[];
  copiedNodes: TaskNode[];
  startCopyMode: () => void;
  toggleCopySelection: (nodeId: string) => void;
  endCopyMode: () => void;
  pasteCopiedNodesInto: (projectId: string, targetNodeId: string) => void;

  // デモ録画用の操作可視化演出（キー入力ポップ＋クリック波紋）のON/OFF。
  // 録画時だけ使う一時的な見た目のトグルなので永続化しない
  isDemoEffectsEnabled: boolean;
  toggleDemoEffects: () => void;

  // ──── 優先タスクの一括操作（複数ノードを選択→登録/達成/削除を一括適用） ─────
  // コピー機能(isCopyModeActive等)と同じ選択UXをツリー上で行う。ドロワーの
  // 「優先タスク」見出しの「登録」「削除」ボタンから開始し、選択完了は
  // コピー機能と同様にHeader.tsxの外部ボタン（ドロワーが閉じている間の唯一の操作口）
  // から行う
  priorityBulkActionType: 'register' | 'delete' | null;
  priorityBulkSelectionIds: string[];
  startPriorityBulkAction: (type: 'register' | 'delete') => void;
  togglePriorityBulkSelection: (nodeId: string) => void;
  endPriorityBulkAction: () => void;

  // ──── 期限の一括登録（カレンダーで日付を選択→複数ノードへ一括適用） ────────
  // カレンダー見出しの「期限を一括登録」ボタンで開始。他の一括操作と違い、まず
  // （ドロワーを開いたまま）カレンダー上で対象日を選ぶフェーズがあり、日付選択後に
  // 初めてドロワーが閉じてノード選択フェーズに入る。既に期限が設定済みのノードも
  // 上書きする
  isDueDateBulkActive: boolean;
  dueDateBulkTargetDate: string | null;
  dueDateBulkSelectionIds: string[];
  startDueDateBulkAction: () => void;
  pickDueDateBulkTargetDate: (date: string) => void;
  toggleDueDateBulkSelection: (nodeId: string) => void;
  endDueDateBulkAction: () => void;

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

  // ゲスト向け誘導ガイド(第2段)。「操作方法」ノードの誘導([[TreePage.tsx]]のnodeGuideStep)が
  // 終わった後、サイドドロワー・パッチノートへ誘導する。ドロワー開閉やモーダル開閉は
  // 一度開いて閉じると元に戻ってしまう一過性のUI状態なので、ツリーの状態だけからは
  // 導出できず、この段階だけは明示的なstepを持つ(Header.tsx/RightDrawerPanel.tsxが読む)。
  // 永続化はしない(persistのpartializeに含めない)
  drawerGuideStep: DrawerGuideStep;
  setDrawerGuideStep: (step: DrawerGuideStep) => void;

  // 誘導完了後の締めのメッセージ(TreePage.tsx)を表示中かどうか。この間、
  // メッセージ内で紹介しているタスクパネルボタンをHeader.tsx側で光らせるため、
  // TreePage.tsxだけでなくHeader.tsxからも参照できるようstoreに置く
  showGuideClosingMessage: boolean;
  setShowGuideClosingMessage: (value: boolean) => void;
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
        // ログイン/ログアウトを繰り返しても前回開いていたプロジェクトのツリー画面や
        // 右ドロワーへ直行してしまわないよう、画面遷移状態も必ずリセットする
        set((state) => ({
          isGuest: true,
          user: null,
          nickname: 'ゲスト',
          view: 'dashboard',
          currentProjectId: null,
          selectedPath: [],
          rightPanel: { ...state.rightPanel, isOpen: false },
          isCopyModeActive: false,
          copySelectionIds: [],
          priorityBulkActionType: null,
          priorityBulkSelectionIds: [],
          isDueDateBulkActive: false,
          dueDateBulkTargetDate: null,
          dueDateBulkSelectionIds: [],
        }));

        const hasSampleProject = get().projects.some(
          (project) => project.id === SAMPLE_PROJECT_ID,
        );
        if (!hasSampleProject) {
          get().importProject(makeSampleProject());
        } else {
          // ページを再読み込みせずログアウト→ゲストを繰り返した場合、persistの
          // merge()によるマイグレーション(下記ensureSampleProjectFresh)は
          // 走らないため、ここでも既存のサンプルプロジェクトの補完・期限の再計算を行う
          set((state) => ({
            projects: state.projects.map(ensureSampleProjectFresh),
          }));
        }
      },

      resetSampleTutorial: () => {
        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== SAMPLE_PROJECT_ID) return project;

            const resetNode = normalizeTaskNode(
              makeTutorialNode(),
              project.rootTask.createdBy,
            );

            return updateProjectRoot(project, {
              ...project.rootTask,
              children: project.rootTask.children.map((child) =>
                child.id === TUTORIAL_NODE_ID ? resetNode : child,
              ),
            });
          }),
          collapsedNodeIds: state.collapsedNodeIds.filter(
            (id) => id !== TUTORIAL_NODE_ID,
          ),
          // ①(ノード追加)だけでなく②(ドロワー・パッチノート誘導)もやり直せるよう、
          // こちらの状態・達成フラグも一緒にリセットする
          drawerGuideStep: 'idle',
        }));
        clearGuestDrawerGuideDone();

        get().openProject(SAMPLE_PROJECT_ID);
        get().selectNode(TUTORIAL_NODE_ID);
      },

      logout: async () => {
        if (get().isGuest) {
          set((state) => ({
            isGuest: false,
            user: null,
            nickname: '',
            view: 'dashboard',
            currentProjectId: null,
            selectedPath: [],
            rightPanel: { ...state.rightPanel, isOpen: false },
            isCopyModeActive: false,
            copySelectionIds: [],
            priorityBulkActionType: null,
            priorityBulkSelectionIds: [],
            isDueDateBulkActive: false,
            dueDateBulkTargetDate: null,
            dueDateBulkSelectionIds: [],
          }));
          return;
        }
        set((state) => ({
          view: 'dashboard',
          currentProjectId: null,
          selectedPath: [],
          rightPanel: { ...state.rightPanel, isOpen: false },
          isCopyModeActive: false,
          copySelectionIds: [],
          priorityBulkActionType: null,
          priorityBulkSelectionIds: [],
          isDueDateBulkActive: false,
          dueDateBulkTargetDate: null,
          dueDateBulkSelectionIds: [],
        }));
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
      // ゲストは追加・削除の操作自体をUIから提供しない（サンプルプロジェクトのみ表示）ため、
      // ここではガードを設けず、実際の制限はDashboardPage側のUI表示で行う

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

      // ──── コピー機能 ──────────────────────────────────────────────────

      isCopyModeActive: false,
      copySelectionIds: [],
      copiedNodes: [],

      startCopyMode: () => {
        set({ isCopyModeActive: true, copySelectionIds: [] });
        get().closeRightPanel();
      },

      toggleCopySelection: (nodeId) => {
        set((state) => ({
          copySelectionIds: state.copySelectionIds.includes(nodeId)
            ? state.copySelectionIds.filter((id) => id !== nodeId)
            : [...state.copySelectionIds, nodeId],
        }));
      },

      endCopyMode: () => {
        const { copySelectionIds, projects, currentProjectId } = get();

        if (copySelectionIds.length > 0) {
          const project = projects.find((item) => item.id === currentProjectId);
          const nextClipboard = project
            ? copySelectionIds
                .map((id) => findNode(project.rootTask, id))
                .filter((node): node is TaskNode => node !== null)
                .map((node) => cloneNodeDeep(node, false))
            : [];

          // 選択ノードが何も見つからなかった場合（プロジェクトが切り替わった等）は
          // 既存のクリップボードを壊さず、そのまま維持する
          if (nextClipboard.length > 0) {
            set({ copiedNodes: nextClipboard });
          }
        }

        set({ isCopyModeActive: false, copySelectionIds: [] });
        get().openRightPanel();
      },

      pasteCopiedNodesInto: (projectId, targetNodeId) => {
        const { copiedNodes, nickname } = get();
        if (copiedNodes.length === 0) return;

        set((state) => ({
          projects: state.projects.map((project) => {
            if (project.id !== projectId) return project;
            if (!findNode(project.rootTask, targetNodeId)) return project;

            const newChildren = copiedNodes.map((node) =>
              cloneNodeDeep(node, true, nickname),
            );

            const nextRoot = mapNode(project.rootTask, targetNodeId, (node) => ({
              ...node,
              children: [...node.children, ...newChildren],
            }));

            return updateProjectRoot(project, nextRoot);
          }),
        }));
      },

      // ──── デモ演出 ──────────────────────────────────────────────────

      isDemoEffectsEnabled: false,
      toggleDemoEffects: () => {
        set((state) => ({ isDemoEffectsEnabled: !state.isDemoEffectsEnabled }));
      },

      // ──── 優先タスクの一括操作 ────────────────────────────────────────

      priorityBulkActionType: null,
      priorityBulkSelectionIds: [],

      startPriorityBulkAction: (type) => {
        set({ priorityBulkActionType: type, priorityBulkSelectionIds: [] });
        get().closeRightPanel();
      },

      togglePriorityBulkSelection: (nodeId) => {
        set((state) => ({
          priorityBulkSelectionIds: state.priorityBulkSelectionIds.includes(nodeId)
            ? state.priorityBulkSelectionIds.filter((id) => id !== nodeId)
            : [...state.priorityBulkSelectionIds, nodeId],
        }));
      },

      endPriorityBulkAction: () => {
        const { priorityBulkActionType, priorityBulkSelectionIds, currentProjectId } = get();

        if (priorityBulkActionType && currentProjectId) {
          for (const nodeId of priorityBulkSelectionIds) {
            if (priorityBulkActionType === 'register') {
              get().setNodePriority(currentProjectId, nodeId, true);
            } else {
              get().deleteNode(currentProjectId, nodeId);
            }
          }
        }

        set({ priorityBulkActionType: null, priorityBulkSelectionIds: [] });
        get().openRightPanel();
      },

      // ──── 期限の一括登録 ──────────────────────────────────────────────

      isDueDateBulkActive: false,
      dueDateBulkTargetDate: null,
      dueDateBulkSelectionIds: [],

      startDueDateBulkAction: () => {
        // 既に進行中（まだ日付を選んでいないフェーズ）に再度押した場合はキャンセル扱い
        if (get().isDueDateBulkActive) {
          set({
            isDueDateBulkActive: false,
            dueDateBulkTargetDate: null,
            dueDateBulkSelectionIds: [],
          });
          return;
        }

        set({
          isDueDateBulkActive: true,
          dueDateBulkTargetDate: null,
          dueDateBulkSelectionIds: [],
        });
      },

      pickDueDateBulkTargetDate: (date) => {
        set({ dueDateBulkTargetDate: date });
        get().closeRightPanel();
      },

      toggleDueDateBulkSelection: (nodeId) => {
        set((state) => ({
          dueDateBulkSelectionIds: state.dueDateBulkSelectionIds.includes(nodeId)
            ? state.dueDateBulkSelectionIds.filter((id) => id !== nodeId)
            : [...state.dueDateBulkSelectionIds, nodeId],
        }));
      },

      endDueDateBulkAction: () => {
        const { dueDateBulkTargetDate, dueDateBulkSelectionIds, currentProjectId, projects } =
          get();

        if (dueDateBulkTargetDate && currentProjectId) {
          const project = projects.find((item) => item.id === currentProjectId);

          if (project) {
            // 親ノードを選択した場合は、その子孫ノードにも同じ期限が一括で付くようにする
            // （子孫を1つずつ選ばなくても済むようにし、工数を削減する）。Setで集約する
            // ことで、選択した複数ノードの子孫が重なっても二重に処理しない
            const targetIds = new Set<string>();
            for (const nodeId of dueDateBulkSelectionIds) {
              const node = findNode(project.rootTask, nodeId);
              if (!node) continue;
              collectNodes(node).forEach((descendant) => targetIds.add(descendant.id));
            }

            for (const nodeId of targetIds) {
              get().updateNodeDueDate(currentProjectId, nodeId, dueDateBulkTargetDate);
            }
          }
        }

        set({
          isDueDateBulkActive: false,
          dueDateBulkTargetDate: null,
          dueDateBulkSelectionIds: [],
        });
        get().openRightPanel();
      },

      // ──── ゲスト向け誘導ガイド第2段 ────────────────────────────────────

      drawerGuideStep: 'idle',
      setDrawerGuideStep: (step) => set({ drawerGuideStep: step }),

      showGuideClosingMessage: false,
      setShowGuideClosingMessage: (value) => set({ showGuideClosingMessage: value }),
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

        const persistedProjects = Array.isArray(persisted?.projects)
          ? persisted.projects.map((project) => normalizeProject(project))
          : currentState.projects;
        // 全ユーザー最初からサンプルプロジェクト＋バックアップJSONが存在している仕様のため、
        // プロジェクトが1件もない初回利用時にだけ差し込む
        const projects = seedInitialProjects(persistedProjects).map(
          ensureSampleProjectFresh,
        );

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
