// src/utils/taskTree.ts

import type { Project, TaskNode } from '../types';

export type FlatTask = {
  projectId: string;
  projectTitle: string;
  node: TaskNode;
  pathIds: string[];
  pathTitles: string[];
};

/** プロジェクトの木構造を、ルートから各ノードまでのパス情報付きで平坦化する */
export function flattenProjectTasks(project: Project): FlatTask[] {
  const result: FlatTask[] = [];

  const walk = (node: TaskNode, pathIds: string[], pathTitles: string[]) => {
    const nextPathIds = [...pathIds, node.id];
    const nextPathTitles = [...pathTitles, node.title];

    result.push({
      projectId: project.id,
      projectTitle: project.title,
      node,
      pathIds: nextPathIds,
      pathTitles: nextPathTitles,
    });

    node.children.forEach((child) => {
      walk(child, nextPathIds, nextPathTitles);
    });
  };

  walk(project.rootTask, [], []);

  return result;
}

/** パス表示（パンくず）の1セグメントあたりの最大文字数のデフォルト値（サイドドロワー向け） */
const DEFAULT_PATH_SEGMENT_MAX_LENGTH = 5;

export function truncateSegment(
  title: string,
  maxLength: number = DEFAULT_PATH_SEGMENT_MAX_LENGTH,
): string {
  return title.length > maxLength ? `${title.slice(0, maxLength)}…` : title;
}

/** 先頭・末尾それぞれ何ノードまで残すか。TreePageのBreadcrumbとも共有する */
export const PATH_HEAD_TAIL_COUNT = 2;

/**
 * サイドドロワーの「今日が期限のタスク」「優先的タスク」「カレンダー」に表示する
 * パンくず用に、パスを短く整形する。全階層をそのまま連結すると幅の狭いドロワーでは
 * 必ず見切れてしまうため、各ノード名を先頭4〜5文字に切り詰めたうえで、
 * 4ノード以下ならすべて表示し、5ノード以上なら先頭2つ・末尾2つだけを残して
 * 中間を「…」で省略する
 */
export function formatCompactPath(
  pathTitles: string[],
  segmentMaxLength: number = DEFAULT_PATH_SEGMENT_MAX_LENGTH,
): string {
  const truncate = (title: string) => truncateSegment(title, segmentMaxLength);

  if (pathTitles.length <= PATH_HEAD_TAIL_COUNT * 2) {
    return pathTitles.map(truncate).join(' / ');
  }

  const head = pathTitles.slice(0, PATH_HEAD_TAIL_COUNT).map(truncate);
  const tail = pathTitles.slice(-PATH_HEAD_TAIL_COUNT).map(truncate);

  return `${head.join(' / ')} / … / ${tail.join(' / ')}`;
}
