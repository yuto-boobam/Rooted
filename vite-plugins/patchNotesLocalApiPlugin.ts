import { randomBytes } from 'node:crypto';
import { rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Connect, Plugin, ViteDevServer } from 'vite';

const API_PATH = '/__rooted-api/patch-notes';
const TARGET_RELATIVE_PATH = 'src/data/patchNotes.json';
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const VALID_TYPES = new Set(['feature', 'bugfix', 'other']);

export function patchNotesLocalApiPlugin(): Plugin {
  return {
    name: 'rooted-patch-notes-local-api',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(API_PATH, (req, res) => {
        void handleRequest(req, res, server.config.root);
      });
    },
  };
}

async function handleRequest(
  req: Connect.IncomingMessage,
  res: import('node:http').ServerResponse,
  rootDir: string,
): Promise<void> {
  if (req.method !== 'POST') {
    respond(res, 405, 'POSTメソッドのみ受け付けています。');
    return;
  }

  const remoteAddress = req.socket.remoteAddress ?? '';

  if (!LOOPBACK_ADDRESSES.has(remoteAddress)) {
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

  const validationError = validatePatchNotesPayload(parsed);

  if (validationError) {
    respond(res, 400, validationError);
    return;
  }

  const targetPath = join(rootDir, TARGET_RELATIVE_PATH);
  const tmpPath = `${targetPath}.tmp-${randomBytes(4).toString('hex')}`;

  try {
    await writeFile(tmpPath, body, 'utf-8');
    await rename(tmpPath, targetPath);
  } catch (error) {
    respond(res, 500, error instanceof Error ? error.message : 'ファイルの書き込みに失敗しました。');
    return;
  }

  respond(res, 200, JSON.stringify({ ok: true }), 'application/json');
}

function validatePatchNotesPayload(payload: unknown): string | null {
  if (!Array.isArray(payload)) {
    return 'パッチノートは配列である必要があります。';
  }

  for (const note of payload) {
    if (typeof note !== 'object' || note === null) {
      return '各パッチノートはオブジェクトである必要があります。';
    }

    const record = note as Record<string, unknown>;

    if (typeof record.id !== 'string' || record.id.trim().length === 0) {
      return 'idが不正です。';
    }

    if (typeof record.date !== 'string' || !DATE_KEY_PATTERN.test(record.date)) {
      return 'dateが不正です（YYYY-MM-DD形式で指定してください）。';
    }

    if (!VALID_TYPES.has(record.type as string)) {
      return 'typeが不正です。';
    }

    if (typeof record.title !== 'string') {
      return 'titleが不正です。';
    }

    if (typeof record.description !== 'string') {
      return 'descriptionが不正です。';
    }

    if (
      typeof record.buildNumber !== 'number' ||
      !Number.isInteger(record.buildNumber) ||
      record.buildNumber <= 0
    ) {
      return 'buildNumberが不正です（正の整数を指定してください）。';
    }
  }

  return null;
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
