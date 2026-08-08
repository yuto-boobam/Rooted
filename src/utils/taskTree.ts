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
