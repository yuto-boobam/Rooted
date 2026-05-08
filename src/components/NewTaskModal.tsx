import { useState } from 'react';

type Mode = 'child' | 'sibling';

type Props = {
  /** 'child' = 子タスク追加 / 'sibling' = 兄弟タスク追加 */
  mode: Mode;
  onConfirm: (title: string, memo: string) => void;
  onClose: () => void;
};

export function NewTaskModal({ mode, onConfirm, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [memo, setMemo]   = useState('');

  const canSubmit = title.trim().length >= 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm(title.trim(), memo.trim());
    onClose();
  };

  const heading = mode === 'child' ? '子タスクを追加' : '兄弟タスクを追加';
  const placeholder = mode === 'child'
    ? '例: データ収集、レポート作成...'
    : '例: テスト実施、デプロイ...';

  return (
    /* オーバーレイ背景 */
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* モーダル本体 */}
      <div
        className="animate-scaleIn w-full max-w-lg mx-4 rounded-3xl p-8 flex flex-col gap-6"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
            {heading}
          </h2>
          <button id="close-task-modal" className="btn-icon" onClick={onClose} title="閉じる">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* タイトル入力 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              タイトル <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="new-task-title"
              type="text"
              className="input-field"
              placeholder={placeholder}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* 概要入力 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              概要 <span style={{ color: 'var(--text-muted)' }}>(任意)</span>
            </label>
            <textarea
              id="new-task-memo"
              className="input-field"
              placeholder="タスクの内容や目的を入力..."
              rows={3}
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

          {/* ボタン群 */}
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>
              キャンセル
            </button>
            <button
              id="confirm-new-task"
              type="submit"
              className="btn-primary"
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              追加する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
