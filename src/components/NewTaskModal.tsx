// src/components/NewTaskModal.tsx

import { useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';

type Mode = 'child' | 'sibling';

type Props = {
  /** 'child' = 子タスク追加 / 'sibling' = 兄弟タスク追加 */
  mode: Mode;

  /**
   * 既存呼び出し互換のため、引数形式を維持しつつ後ろに追加しています。
   *
   * TreePage 側では以下のように受け取ってください:
   * onConfirm={(title, memo, detailMemo, dueDate, isPriority) => { ... }}
   */
  onConfirm: (
    title: string,
    memo: string,
    detailMemo: string,
    dueDate: string | null,
    isPriority: boolean,
  ) => void;

  onClose: () => void;
};

export function NewTaskModal({ mode, onConfirm, onClose }: Props) {
  const [title, setTitle] = useState('');
  const [memo, setMemo] = useState('');
  const [detailMemo, setDetailMemo] = useState('');
  const [hasDueDate, setHasDueDate] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [isPriority, setIsPriority] = useState(false);

  const canSubmit = title.trim().length >= 1;

  const heading = mode === 'child' ? '子タスクを追加' : '兄弟タスクを追加';

  const placeholder =
    mode === 'child'
      ? '例: データ収集、レポート作成...'
      : '例: テスト実施、デプロイ...';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) return;

    onConfirm(
      title.trim(),
      memo.trim(),
      detailMemo.trim(),
      hasDueDate && dueDate ? dueDate : null,
      isPriority,
    );

    onClose();
  };

  const handleToggleDueDate = () => {
    const next = !hasDueDate;
    setHasDueDate(next);

    if (next && !dueDate) {
      setDueDate(todayDateKey());
    }

    if (!next) {
      setDueDate('');
    }
  };

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      role="presentation"
    >
      <div
        style={styles.modal}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-task-modal-title"
      >
        <div style={styles.header}>
          <div>
            <h2 id="new-task-modal-title" style={styles.title}>
              {heading}
            </h2>
            <p style={styles.description}>
              タイトル、概要、詳細、期限、優先設定をまとめて登録できます。
            </p>
          </div>

          <button
            id="close-task-modal"
            type="button"
            style={styles.closeButton}
            onClick={onClose}
            aria-label="閉じる"
            title="閉じる"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>
              タイトル <span style={styles.required}>*</span>
            </span>

            <input
              id="new-task-title"
              type="text"
              style={styles.input}
              placeholder={placeholder}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>
              概要メモ <span style={styles.optional}>任意</span>
            </span>

            <input
              id="new-task-memo"
              type="text"
              style={styles.input}
              placeholder="例: 何をするタスクかを短く入力..."
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>
              詳細メモ <span style={styles.optional}>任意</span>
            </span>

            <textarea
              id="new-task-detail-memo"
              style={styles.textarea}
              placeholder="具体的な手順、仕様、確認事項などを入力..."
              value={detailMemo}
              onChange={(event) => setDetailMemo(event.target.value)}
              rows={5}
            />
          </label>

          <section style={styles.optionCard}>
            <div style={styles.optionHeader}>
              <div>
                <div style={styles.optionTitle}>期限設定</div>
                <p style={styles.optionText}>
                  ON にすると日付選択カレンダーから期限を設定できます。
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={hasDueDate}
                style={{
                  ...styles.switchButton,
                  ...(hasDueDate ? styles.switchButtonOn : {}),
                }}
                onClick={handleToggleDueDate}
              >
                <span
                  style={{
                    ...styles.switchKnob,
                    transform: hasDueDate
                      ? 'translateX(22px)'
                      : 'translateX(0)',
                  }}
                />
              </button>
            </div>

            {hasDueDate && (
              <label style={styles.dateField}>
                <span style={styles.label}>期限日</span>

                <input
                  id="new-task-due-date"
                  type="date"
                  style={styles.input}
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </label>
            )}
          </section>

          <label style={styles.priorityRow}>
            <input
              id="new-task-priority"
              type="checkbox"
              checked={isPriority}
              onChange={(event) => setIsPriority(event.target.checked)}
              style={styles.checkbox}
            />

            <span>
              <span style={styles.priorityTitle}>優先タスクに追加</span>
              <span style={styles.priorityText}>
                右側のタスク集中パネルに表示し、優先順位を付けられます。
              </span>
            </span>
          </label>

          <div style={styles.actions}>
            <button type="button" style={styles.cancelButton} onClick={onClose}>
              キャンセル
            </button>

            <button
              id="confirm-new-task"
              type="submit"
              style={{
                ...styles.primaryButton,
                opacity: canSubmit ? 1 : 0.45,
                cursor: canSubmit ? 'pointer' : 'not-allowed',
              }}
              disabled={!canSubmit}
            >
              <span style={styles.plusIcon}>＋</span>
              追加する
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function todayDateKey(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    background: 'rgba(0, 0, 0, 0.72)',
    backdropFilter: 'blur(5px)',
  },

  modal: {
    width: 'min(560px, 100%)',
    maxHeight: '92vh',
    overflowY: 'auto',
    borderRadius: 24,
    padding: 28,
    background: 'var(--bg-surface, rgba(15, 23, 42, 0.98))',
    border: '1px solid var(--border, rgba(148, 163, 184, 0.22))',
    boxShadow: '0 24px 80px rgba(0, 0, 0, 0.45)',
    color: 'var(--text-primary, #f8fafc)',
  },

  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 18,
    marginBottom: 24,
  },

  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: 'var(--text-primary, #f8fafc)',
  },

  description: {
    margin: '6px 0 0',
    fontSize: 13,
    lineHeight: 1.6,
    color: 'var(--text-secondary, #94a3b8)',
  },

  closeButton: {
    flex: '0 0 auto',
    width: 34,
    height: 34,
    borderRadius: 12,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary, #cbd5e1)',
    cursor: 'pointer',
    fontSize: 22,
    lineHeight: 1,
  },

  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 20,
  },

  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  label: {
    fontSize: 13,
    fontWeight: 800,
    color: 'var(--text-secondary, #cbd5e1)',
  },

  required: {
    color: 'var(--danger, #fb7185)',
  },

  optional: {
    marginLeft: 6,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted, #64748b)',
  },

  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '12px 14px',
    background: 'var(--bg-base)',
    color: 'var(--text-primary, #f8fafc)',
    outline: 'none',
    fontSize: 14,
  },

  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '12px 14px',
    background: 'var(--bg-base)',
    color: 'var(--text-primary, #f8fafc)',
    outline: 'none',
    fontSize: 14,
    resize: 'vertical',
    minHeight: 118,
    lineHeight: 1.6,
  },

  optionCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(96, 165, 250, 0.22)',
    background: 'rgba(30, 64, 175, 0.10)',
  },

  optionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },

  optionTitle: {
    color: 'var(--accent-blue-text)',
    fontSize: 14,
    fontWeight: 900,
  },

  optionText: {
    margin: '5px 0 0',
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.5,
  },

  switchButton: {
    position: 'relative',
    flex: '0 0 auto',
    width: 50,
    height: 28,
    borderRadius: 999,
    border: '1px solid rgba(148, 163, 184, 0.28)',
    background: 'rgba(51, 65, 85, 0.9)',
    padding: 2,
    cursor: 'pointer',
    transition: 'background 160ms ease, border-color 160ms ease',
  },

  switchButtonOn: {
    borderColor: 'rgba(96, 165, 250, 0.55)',
    background: 'rgba(37, 99, 235, 0.9)',
  },

  switchKnob: {
    display: 'block',
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#f8fafc',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)',
    transition: 'transform 160ms ease',
  },

  dateField: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  priorityRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(251, 113, 133, 0.24)',
    background: 'rgba(127, 29, 29, 0.10)',
    cursor: 'pointer',
  },

  checkbox: {
    width: 18,
    height: 18,
    marginTop: 1,
    accentColor: '#fb7185',
    cursor: 'pointer',
  },

  priorityTitle: {
    display: 'block',
    color: 'var(--accent-rose-text)',
    fontSize: 14,
    fontWeight: 900,
  },

  priorityText: {
    display: 'block',
    marginTop: 5,
    color: 'var(--text-secondary)',
    fontSize: 12,
    lineHeight: 1.5,
  },

  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 4,
  },

  cancelButton: {
    border: '1px solid var(--border)',
    borderRadius: 13,
    padding: '10px 15px',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary, #cbd5e1)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 800,
  },

  primaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    border: '1px solid rgba(59, 130, 246, 0.48)',
    borderRadius: 13,
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 900,
  },

  plusIcon: {
    fontSize: 16,
    lineHeight: 1,
  },
};
