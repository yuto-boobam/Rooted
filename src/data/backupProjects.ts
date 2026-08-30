// src/data/backupProjects.ts
// src/data/backups/ に置かれたプロジェクトのバックアップJSONを起動時に自動で読み込む。
//
// 運用: Headerの「バックアップ」→「エクスポート」で書き出したJSON
// （{formatVersion, exportedAt, project} 形式。project本体だけでも可）を、
// そのまま src/data/backups/ に置いてコミットする。ファイル名は自由。
// インポート操作なしに、初回起動時（プロジェクトが1件もない状態）に
// サンプルプロジェクトと合わせて自動的に差し込まれる（Combo-LABのcomboShowcase.tsと同じ運用）

import type { Project } from '../types';

type BackupPayload = { project?: Partial<Project> } | Partial<Project>;

function isProjectLike(value: unknown): value is Partial<Project> {
  return Boolean(value) && typeof value === 'object' && 'rootTask' in (value as object);
}

function extractProject(payload: BackupPayload): Partial<Project> | null {
  if (isProjectLike(payload)) return payload;
  const wrapped = (payload as { project?: Partial<Project> }).project;
  return wrapped && isProjectLike(wrapped) ? wrapped : null;
}

const sourceModules = import.meta.glob('./backups/*.json', {
  eager: true,
}) as Record<string, { default: BackupPayload }>;

export const BACKUP_PROJECTS: Partial<Project>[] = Object.values(sourceModules)
  .map((mod) => extractProject(mod.default))
  .filter((project): project is Partial<Project> => project !== null);
