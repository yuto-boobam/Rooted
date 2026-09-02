// パッチノート画像などの「ルート相対パス（/images/...）」を、GitHub Pages公開時の
// base パス（vite.config.ts の base: '/Rooted/'）配下でも正しく解決するためのヘルパー。
// ローカルAPI（vite-plugins/patchNotesLocalApiPlugin.ts）が返す/保存されるURLは常に
// ルート相対のままなので、表示側でbaseを付与する。

export function resolvePublicImageUrl(url: string): string {
  if (!url.startsWith('/') || url.startsWith('//')) {
    return url;
  }

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  if (base === '' || url.startsWith(`${base}/`)) {
    return url;
  }

  return `${base}${url}`;
}
