// src/components/DrawerLogoutFooter.tsx
// サイドドロワー共通のフッター。頻度の低いログアウト操作をここに集約する。

import type { CSSProperties } from 'react';
import { useAppStore } from '../store';

export default function DrawerLogoutFooter() {
  const isGuest = useAppStore((state) => state.isGuest);
  const logout = useAppStore((state) => state.logout);

  return (
    <div style={styles.footer}>
      <button
        type="button"
        style={styles.logoutButton}
        onClick={() => logout()}
        title={isGuest ? 'ゲストモードを終了' : 'ログアウト'}
      >
        <span>🚪</span>
        <span>{isGuest ? 'ゲストモードを終了' : 'ログアウト'}</span>
      </button>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  footer: {
    padding: 12,
    borderTop: '1px solid var(--border)',
  },
  logoutButton: {
    width: '100%',
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 11,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
  },
};
