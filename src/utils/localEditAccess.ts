const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1']);

export function isLoopbackHostname(hostname: string = window.location.hostname): boolean {
  return LOOPBACK_HOSTNAMES.has(hostname);
}

// UI表示の制御にのみ使う判定。実際のアクセス制御は必ずサーバ側（現状はVite dev
// serverのloopbackチェック、将来バックエンドが変わっても同様）で再検証すること。
export function canEditPatchNotesLocally(): boolean {
  return import.meta.env.DEV && isLoopbackHostname();
}

// バックアップの「プロジェクトへ保存」（src/data/backups/への直接書き込み）も、
// メンテナが手元でnpm run devした時だけ行えるようにする
export function canEditBackupProjectsLocally(): boolean {
  return import.meta.env.DEV && isLoopbackHostname();
}
