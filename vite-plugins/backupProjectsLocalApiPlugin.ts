// vite-plugins/backupProjectsLocalApiPlugin.ts
// Rootedのローカル専用API。ブラウザから開発サーバーへプロジェクトのJSONを送り、
// src/data/backups/ へ直接書き込む（Combo-LABのcomboLabLocalApiPluginと同じ考え方。
// src/data/backupProjects.ts が起動時に自動で読み込むディレクトリと同じ場所に保存する）。
// 本番ビルドには含まれない（apply: 'serve'）。

import { randomBytes } from 'node:crypto';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Connect, Plugin, ViteDevServer } from 'vite';

const MOUNT_PATH = '/__rooted-backup-api';
const BACKUP_TARGET_RELATIVE_DIR = 'src/data/backups';
const MAX_BODY_BYTES = 4 * 1024 * 1024; // 4MB（テキストのみのデータなので十分）
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
// ファイル名（プロジェクトid）に使える文字を制限し、パストラバーサルを防ぐ
const SAFE_PROJECT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function backupProjectsLocalApiPlugin(): Plugin {
  return {
    name: 'rooted-backup-projects-local-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(MOUNT_PATH, (req, res) => {
        const path = req.url ?? '';

        if (path === '/project') {
          void handleSaveProject(req, res, server.config.root);
          return;
        }

        respond(res, 404, 'Not Found');
      });
    },
  };
}

async function handleSaveProject(
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  rootDir: string,
): Promise<void> {
  if (req.method !== 'POST') {
    respond(res, 405, 'POSTメソッドのみ受け付けています。');
    return;
  }

  if (!isLoopbackRequest(req)) {
    respond(res, 403, 'ローカル環境からのリクエストのみ受け付けています。');
    return;
  }

  let body: string;

  try {
    body = await readBody(req, MAX_BODY_BYTES);
  } catch (error) {
    respond(res, error instanceof Error && error.message === 'TOO_LARGE' ? 413 : 400, 'リクエストの読み取りに失敗しました。');
    return;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(body);
  } catch {
    respond(res, 400, 'JSONの解析に失敗しました。');
    return;
  }

  const projectId = extractProjectId(parsed);

  if (!projectId) {
    respond(res, 400, '{project: {id, rootTask, ...}} という形式である必要があります。');
    return;
  }

  if (!SAFE_PROJECT_ID_PATTERN.test(projectId)) {
    respond(res, 400, 'idの形式が不正です（英数字・アンダースコア・ハイフンのみ）。');
    return;
  }

  const targetDir = join(rootDir, BACKUP_TARGET_RELATIVE_DIR);
  const targetPath = join(targetDir, `${projectId}.json`);
  const tmpPath = `${targetPath}.tmp-${randomBytes(4).toString('hex')}`;

  try {
    await mkdir(targetDir, { recursive: true });
    await writeFile(tmpPath, body, 'utf-8');
    await rename(tmpPath, targetPath);
  } catch (error) {
    respond(res, 500, error instanceof Error ? error.message : 'ファイルの書き込みに失敗しました。');
    return;
  }

  respond(res, 200, JSON.stringify({ ok: true }), 'application/json');
}

function extractProjectId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const project = (payload as Record<string, unknown>).project;
  if (typeof project !== 'object' || project === null) return null;

  const record = project as Record<string, unknown>;
  if (!('rootTask' in record)) return null;

  const id = record.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function isLoopbackRequest(req: Connect.IncomingMessage): boolean {
  return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? '');
}

function readBody(req: Connect.IncomingMessage, maxBytes: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;

      if (totalBytes > maxBytes) {
        reject(new Error('TOO_LARGE'));
        req.destroy();
        return;
      }

      chunks.push(chunk);
    });

    req.on('end', () => {
      resolve(Buffer.concat(chunks).toString('utf-8'));
    });

    req.on('error', reject);
  });
}

function respond(
  res: import('node:http').ServerResponse,
  statusCode: number,
  message: string,
  contentType = 'text/plain; charset=utf-8',
): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', contentType);
  res.end(message);
}
