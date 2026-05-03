import { useAppStore } from './store';
import { DashboardPage } from './pages/DashboardPage';
import { TreePage } from './pages/TreePage';

/**
 * App.tsx — アプリのエントリポイント。
 * view ステートに応じてページを切り替える（シングルページアーキテクチャ）。
 */
function App() {
  const view = useAppStore((s) => s.view);

  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      {view === 'dashboard' ? <DashboardPage /> : <TreePage />}
    </div>
  );
}

export default App;