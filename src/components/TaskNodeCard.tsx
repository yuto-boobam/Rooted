import { useState, useRef } from 'react';
import type { TaskNode } from '../types';

type Props = {
  node: TaskNode;
  isSelected: boolean;
  isRoot?: boolean;
  accentColor: string;

  onClick: () => void;
  onToggleComplete: () => void;
  onUpdateTitle: (title: string) => void;
  onUpdateMemo: (memo: string) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;

  // ドラッグ&ドロップ用
  parentId: string | null;
  dragIndex: number;
  onDragOver: (index: number) => void;
  onDrop: (draggedData: { id: string; parentId: string | null; index: number }) => void;
};

export function TaskNodeCard({
  node,
  isSelected,
  isRoot = false,
  accentColor,
  onClick,
  onToggleComplete,
  onUpdateTitle,
  onUpdateMemo,
  onAddChild,
  onAddSibling,
  onDelete,
  parentId,
  dragIndex,
  onDragOver,
  onDrop,
}: Props) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingMemo, setIsEditingMemo] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const memoRef = useRef<HTMLInputElement>(null);

  const isLeaf = node.children.length === 0;
  // progress は refreshProgress ボタン押下時のみ更新される（node.progress をそのまま参照）
  const progress = node.progress;

  // ── キーボード操作（タイトル編集中）
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setIsEditingTitle(false);
      onAddChild(); // Enter → 子タスクを追加
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      setIsEditingTitle(false);
      onAddSibling(); // Tab → 兄弟タスクを追加
    }
    if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const borderColor = isSelected ? accentColor : 'var(--border)';
  const glowStyle = isSelected ? `0 0 0 1px ${accentColor}40` : 'none';

  return (
    <div
      id={`node-${node.id}`}
      draggable={!isRoot}
      onDragStart={(e) => {
        e.dataTransfer.setData(
          'application/json',
          JSON.stringify({ id: node.id, parentId, index: dragIndex })
        );
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setIsDragOver(true);
        onDragOver(dragIndex);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          if (data && data.id) {
            onDrop(data);
          }
        } catch (err) {
          console.error('Drop error', err);
        }
      }}
      onClick={onClick}
      className="animate-fadeIn flex flex-col gap-3 rounded-xl cursor-pointer transition-all duration-150 select-none relative z-10"
      style={{
        padding: '20px 24px',
        background: isSelected ? `${accentColor}10` : 'var(--bg-surface)',
        border: `1px solid ${isDragOver ? accentColor : borderColor}`,
        boxShadow: isDragOver ? `0 0 0 2px ${accentColor}30` : glowStyle,
        minHeight: isRoot ? 160 : 120,
        width: isRoot ? 240 : '100%',
      }}
    >
      {/* ── 上部：チェックボックス＋タイトル＋削除ボタン */}
      <div className="flex items-start gap-3">
        {/* チェックボックス（leafのみ有効） */}
        <button
          className="mt-0.5 flex-shrink-0 w-4 h-4 rounded flex items-center justify-center transition-all"
          style={{
            border: `1.5px solid ${node.completed ? accentColor : 'var(--text-muted)'}`,
            background: node.completed ? accentColor : 'transparent',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isLeaf) onToggleComplete();
          }}
          title={isLeaf ? (node.completed ? '未完了に戻す' : '完了にする') : '子タスクが存在するため直接完了できません'}
        >
          {node.completed && (
            <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2">
              <polyline points="1.5,5 4,7.5 8.5,2.5" />
            </svg>
          )}
        </button>

        {/* タイトル */}
        {isEditingTitle ? (
          <textarea
            ref={titleRef}
            className="input-inline text-sm font-medium flex-1"
            value={node.title}
            autoFocus
            rows={2}
            onChange={(e) => onUpdateTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={() => setIsEditingTitle(false)}
            onClick={(e) => e.stopPropagation()}
            style={{ lineHeight: 1.4 }}
          />
        ) : (
          <span
            className="text-sm font-medium flex-1 leading-snug"
            style={{
              color: node.completed ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: node.completed ? 'line-through' : 'none',
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditingTitle(true);
              setTimeout(() => titleRef.current?.focus(), 0);
            }}
          >
            {node.title || '（タイトルなし）'}
          </span>
        )}

        {/* 削除ボタン（rootは不可） */}
        {!isRoot && (
          <button
            className="btn-icon flex-shrink-0 opacity-0 group-hover:opacity-100"
            style={{ width: 20, height: 20, opacity: isSelected ? 1 : undefined }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="このノードを削除"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── メモ欄 */}
      {isEditingMemo ? (
        <input
          ref={memoRef}
          type="text"
          className="input-inline text-xs"
          placeholder="概要メモを入力..."
          value={node.memo}
          autoFocus
          onChange={(e) => onUpdateMemo(e.target.value)}
          onBlur={() => setIsEditingMemo(false)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setIsEditingMemo(false);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ color: 'var(--text-secondary)' }}
        />
      ) : (
        <p
          className="text-xs cursor-text"
          style={{
            color: node.memo ? 'var(--text-secondary)' : 'var(--text-muted)',
            minHeight: 16,
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setIsEditingMemo(true);
          }}
        >
          {node.memo || '概要メモ（ダブルクリックで編集）'}
        </p>
      )}

      {/* ── 子ノード数＋進捗バー（子がある場合のみ） */}
      {!isLeaf && (
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              📋 {node.children.length}
            </span>
            <span className="text-xs font-medium" style={{ color: accentColor }}>
              {progress}%
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${progress}%`, background: accentColor }}
            />
          </div>
        </div>
      )}

      {/* ── ドラッグハンドル（rootは非表示） */}
      {!isRoot && (
        <div
          className="flex items-center justify-center mt-0.5 opacity-20"
          style={{ cursor: 'grab' }}
        >
          <svg width="20" height="8" viewBox="0 0 20 8" fill="currentColor" style={{ color: 'var(--text-muted)' }}>
            <circle cx="4" cy="2" r="1.5" /><circle cx="10" cy="2" r="1.5" /><circle cx="16" cy="2" r="1.5" />
            <circle cx="4" cy="6" r="1.5" /><circle cx="10" cy="6" r="1.5" /><circle cx="16" cy="6" r="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
}
