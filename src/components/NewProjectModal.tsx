import { useState } from 'react';

type Props = {
  onConfirm: (title: string, description: string) => void;
  onClose: () => void;
};

export function NewProjectModal({ onConfirm, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const canSubmit = title.trim().length >= 3;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    onConfirm(title.trim(), description.trim());
    onClose();
  };

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
            新しいプロジェクト
          </h2>
          <button id="close-modal" className="btn-icon" onClick={onClose} title="閉じる">
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
              id="new-project-title"
              type="text"
              className="input-field"
              placeholder="例: 卒業研究、Webサイト開発..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
            {/* バリデーションメッセージ */}
            {title.length > 0 && title.trim().length < 3 && (
              <p className="text-xs" style={{ color: 'var(--danger)' }}>
                3文字以上入力してください（現在: {title.trim().length}文字）
              </p>
            )}
          </div>

          {/* 概要入力 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              概要 <span style={{ color: 'var(--text-muted)' }}>(任意)</span>
            </label>
            <textarea
              id="new-project-description"
              className="input-field"
              placeholder="プロジェクトの目的や概要を入力..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>

          {/* ボタン群 */}
          <div className="flex gap-2 justify-end mt-1">
            <button type="button" className="btn-ghost" onClick={onClose}>
              キャンセル
            </button>
            <button
              id="confirm-new-project"
              type="submit"
              className="btn-primary"
              disabled={!canSubmit}
              style={{ opacity: canSubmit ? 1 : 0.4, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              作成する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
