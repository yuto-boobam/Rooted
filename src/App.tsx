import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { DashboardPage } from './pages/DashboardPage';
import { TreePage } from './pages/TreePage';
import { AuthPage } from './pages/AuthPage';
import { supabase } from './utils/supabaseClient';

/**
 * App.tsx — アプリのエントリポイント。
 * ログイン状態（user）に応じて、未ログインならAuthPage、ログイン済ならDashboard/TreePageを切り替える。
 */
function App() {
  const view = useAppStore((s) => s.view);
  const user = useAppStore((s) => s.user);
  const setUser = useAppStore((s) => s.setUser);

  // localStorageからの復元（persist middleware）が完了するまで待つ。
  // 復元が終わる前にsetUser等でstore.set()を呼ぶと、persistミドルウェアが
  // まだ復元されていない初期状態（projects: [] 等）をlocalStorageへ
  // 上書き保存してしまい、保存済みデータが消える原因になるため。
  const [hasHydrated, setHasHydrated] = useState(() =>
    useAppStore.persist.hasHydrated(),
  );

  useEffect(() => {
    if (hasHydrated) return;

    return useAppStore.persist.onFinishHydration(() => setHasHydrated(true));
  }, [hasHydrated]);

  // アプリ起動時およびセッション変更時にSupabaseの認証状態を同期
  useEffect(() => {
    if (!hasHydrated) return;

    // 現在のセッションを一度だけ取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 認証状態の変化（ログイン・ログアウト等）をリアルタイムに検知して同期
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [hasHydrated, setUser]);

  if (!hasHydrated) {
    return null;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      {view === 'dashboard' ? <DashboardPage /> : <TreePage />}
    </div>
  );
}

export default App;