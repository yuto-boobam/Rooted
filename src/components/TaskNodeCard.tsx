import { useState, useRef } from 'react';
import type { TaskNode } from '../types';
import { getDueUrgencyColors } from '../utils/dueDateColor';
import { daysUntil, formatDueDateShort } from '../utils/dueDate';

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

  // 子ノードの開閉（子を持つノードのみ）
  isExpanded?: boolean;
  onToggleExpand?: () => void;

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
  isExpanded = true,
  onToggleExpand,
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

  // 期限が7日以内（当日・超過含む）なら橙色→赤色→深紅のグラデーションで警告表示。
  // 完了済みノードは対象外。未完了で期限に余裕がある／未設定の場合は
  // ノード同士を結ぶ線と同じ見た目になるよう、半透明の白
  // （var(--text-primary)。ライトモード実装時は黒に切り替わる想定）にする。
  const dueUrgency =
    !node.completed && node.dueDate
      ? getDueUrgencyColors(daysUntil(node.dueDate))
      : null;
  const DEFAULT_BORDER_COLOR = 'color-mix(in srgb, var(--text-primary) 50%, transparent)';

  const borderColor = isSelected
    ? accentColor
    : node.completed
      ? 'var(--border)'
      : (dueUrgency?.accent ?? DEFAULT_BORDER_COLOR);
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
      className="animate-fadeIn flex flex-col gap-2 rounded-xl cursor-pointer transition-all duration-150 select-none relative z-10"
      style={{
        padding: '12px 14px',
        background: isSelected ? `${accentColor}10` : 'var(--bg-surface)',
        border: `1px solid ${isDragOver ? accentColor : borderColor}`,
        boxShadow: isDragOver ? `0 0 0 2px ${accentColor}30` : glowStyle,
        minHeight: node.completed ? undefined : isRoot ? 110 : 76,
        width: isRoot ? 220 : '100%',
      }}
    >
      {/* ── 開閉トグル（子を持つノードのみ、右端の接続線上に配置） */}
      {!isLeaf && onToggleExpand && (
        <button
          className="flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            position: 'absolute',
            right: -9,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: `1.5px solid ${borderColor}`,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            zIndex: 20,
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          title={isExpanded ? '子タスクを閉じる' : '子タスクを開く'}
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            style={{
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 150ms',
            }}
          >
            <polyline points="9,6 15,12 9,18" />
          </svg>
        </button>
      )}

      {/* ── 上部：チェックボックス＋タイトル＋削除ボタン */}
      <div className="flex items-start gap-2">
        {/* チェックボックス（leafのみ有効） */}
        <button
          className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded flex items-center justify-center transition-all"
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
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2">
              <polyline points="1.5,5 4,7.5 8.5,2.5" />
            </svg>
          )}
        </button>

        {/* タイトル */}
        {isEditingTitle ? (
          <textarea
            ref={titleRef}
            className="input-inline text-xs font-medium flex-1"
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
            className="text-xs font-medium flex-1 leading-snug"
            style={{
              color: node.completed ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: node.completed ? 'line-through' : 'none',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={node.title || undefined}
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
            style={{ width: 16, height: 16, opacity: isSelected ? 1 : undefined }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="このノードを削除"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* ── 達成済みノードはタイトル＋チェックのみに圧縮（詳細はサイドドロワーで編集） */}
      {!node.completed && (
        <>
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
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={node.memo || undefined}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingMemo(true);
              }}
            >
              {node.memo || '概要メモ（ダブルクリックで編集）'}
            </p>
          )}

          {/* ── 期限表示 */}
          {node.dueDate && (
            <div
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: dueUrgency?.accent ?? 'var(--text-primary)' }}
            >
              <span>📅</span>
              <span>期限: {formatDueDateShort(node.dueDate)}</span>
            </div>
          )}

          {/* ── 子ノード数＋進捗バー（子がある場合のみ） */}
          {!isLeaf && (
            <div className="flex flex-col gap-1 mt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  📋 {node.children.length}
                </span>
                <span
                  className="text-xs font-medium"
                  style={{
                    color: isSelected
                      ? accentColor
                      : (dueUrgency?.accent ?? 'var(--text-primary)'),
                  }}
                >
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
        </>
      )}
    </div>
  );
}

