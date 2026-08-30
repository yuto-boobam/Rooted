import { useEffect, useRef, useState } from 'react';
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
  const goToDashboard = useAppStore((s) => s.goToDashboard);
  const closeRightPanel = useAppStore((s) => s.closeRightPanel);
  const isGuest = useAppStore((s) => s.isGuest);
  const theme = useAppStore((s) => s.theme);

  // 配色テーマをHTMLルート要素に反映（CSS変数の切り替えに使う）
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

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

  // 直近まで誰としてログインしていたか（未ログインならnull）。タブ切り替え等で
  // Supabaseが同一ユーザーのまま'SIGNED_IN'を再送出するケースと、実際にログインし
  // 直した（未ログイン→ログイン、または別アカウントへの切り替え）ケースを見分けるために使う
  const previousUserIdRef = useRef<string | null>(null);

  // アプリ起動時およびセッション変更時にSupabaseの認証状態を同期
  // ゲストモード中はSupabaseセッションを持たないため同期をスキップする
  useEffect(() => {
    if (!hasHydrated || isGuest) return;

    // 現在のセッションを一度だけ取得
    supabase.auth.getSession().then(({ data: { session } }) => {
      previousUserIdRef.current = session?.user?.id ?? null;
      setUser(session?.user ?? null);
    });

    // 認証状態の変化（ログイン・ログアウト等）をリアルタイムに検知して同期。
    // 'SIGNED_IN'は「実際にサインインした瞬間」だけでなく、別タブへ切り替えて
    // 戻ってきた時などブラウザがセッションを再検証したタイミングでも、同じユーザーの
    // ままSupabaseから再送出されることがある（supabase-js v2の既知の挙動）。
    // そのため、イベント種別だけでなく「直前と違うユーザーに変わったか」も見て、
    // 本当にログインし直した時だけ画面遷移状態をリセットする。'TOKEN_REFRESHED'等、
    // 操作中にバックグラウンドで発火するイベントまでリセット対象にすると、閲覧中に
    // 突然選択画面へ戻される規模の大きい不具合になるため、対象は厳密に限定する
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user?.id ?? null;

      if (event === 'SIGNED_IN' && previousUserIdRef.current !== nextUserId) {
        goToDashboard();
        closeRightPanel();
      }

      previousUserIdRef.current = nextUserId;
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [hasHydrated, isGuest, setUser, goToDashboard, closeRightPanel]);

  if (!hasHydrated) {
    return null;
  }

  if (!user && !isGuest) {
    return <AuthPage />;
  }

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      {view === 'dashboard' ? <DashboardPage /> : <TreePage />}
    </div>
  );
}

export default App;