import { useEffect } from 'react';
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

  // アプリ起動時およびセッション変更時にSupabaseの認証状態を同期
  useEffect(() => {
    // 現在のセッションを一度だけ取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 認証状態の変化（ログイン・ログアウト等）をリアルタイムに検知して同期
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [setUser]);

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