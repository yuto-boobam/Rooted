import { useState, useRef } from 'react';
import type { TaskNode } from '../types';
import { COPY_PASTE_MIME_TYPE } from '../types';
import { getDueUrgencyColors } from '../utils/dueDateColor';
import { daysUntil, formatDueDateShort } from '../utils/dueDate';
import { applyManualLineBreaks } from '../utils/textDisplay';
import { TREE_LAYOUT_CONFIG } from '../pages/TreePage.config';

const { rootWidth: ROOT_WIDTH, defaultRootHeight: ROOT_HEIGHT, defaultNodeHeight: NODE_HEIGHT } =
  TREE_LAYOUT_CONFIG;

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

  // ゲスト向け誘導ガイド(TreePage.tsx)がこのノードを次の操作対象として示す時にtrue。
  // 光るリング演出を表示する(吹き出し自体はGuideConnector.tsxが別途描画する。
  // 詳細はプロジェクトの記憶参照)
  isGuideTarget?: boolean;

  // コピーモード中の複数選択用（isCopyModeActiveがtrueの間だけ意味を持つ）
  isCopyModeActive?: boolean;
  isCopySelected?: boolean;
  onToggleCopySelect?: () => void;

  // コピー内容（RightDrawerPanel.tsxのプレビューカード）をこのカードへドロップして
  // 貼り付けるためのハンドラ。既存のonDrop（ノード移動）とは別経路で呼ばれる
  onPasteDrop?: () => void;
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
  isGuideTarget = false,
  isCopyModeActive = false,
  isCopySelected = false,
  onToggleCopySelect,
  onPasteDrop,
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
  const COPY_SELECTED_COLOR = '#22c55e'; // 通常の単一選択色(accentColor)と混同しないよう固定色にする

  const borderColor = isCopySelected
    ? COPY_SELECTED_COLOR
    : isSelected
      ? accentColor
      : node.completed
        ? 'var(--border)'
        : (dueUrgency?.accent ?? DEFAULT_BORDER_COLOR);
  const glowStyle = isCopySelected
    ? `0 0 0 2px ${COPY_SELECTED_COLOR}55`
    : isSelected
      ? `0 0 0 1px ${accentColor}40`
      : 'none';

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
        const isPasteDrag = e.dataTransfer.types.includes(COPY_PASTE_MIME_TYPE);
        e.dataTransfer.dropEffect = isPasteDrag ? 'copy' : 'move';
        setIsDragOver(true);
        onDragOver(dragIndex);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);

        if (e.dataTransfer.types.includes(COPY_PASTE_MIME_TYPE)) {
          onPasteDrop?.();
          return;
        }

        try {
          const data = JSON.parse(e.dataTransfer.getData('application/json'));
          if (data && data.id) {
            onDrop(data);
          }
        } catch (err) {
          console.error('Drop error', err);
        }
      }}
      onClick={() => {
        if (isCopyModeActive) {
          onToggleCopySelect?.();
          return;
        }
        onClick();
      }}
      className={`animate-fadeIn flex flex-col cursor-pointer transition-all duration-150 select-none relative z-10${isGuideTarget ? ' tutorial-spotlight-ring' : ''}`}
      style={{
        gap: 6.4,
        borderRadius: 9.6,
        padding: '9.6px 11.2px',
        background: isSelected ? `${accentColor}10` : 'var(--bg-surface)',
        border: `1px solid ${isDragOver ? accentColor : borderColor}`,
        boxShadow: isDragOver ? `0 0 0 2px ${accentColor}30` : glowStyle,
        minHeight: node.completed ? undefined : isRoot ? ROOT_HEIGHT : NODE_HEIGHT,
        width: isRoot ? ROOT_WIDTH : '100%',
      }}
    >
      {isCopySelected && (
        <div
          style={{
            position: 'absolute',
            left: -8,
            top: -8,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: COPY_SELECTED_COLOR,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 900,
            zIndex: 25,
            boxShadow: '0 1px 4px rgba(0,0,0,0.35)',
          }}
        >
          ✓
        </div>
      )}

      {/* ── 開閉トグル（子を持つノードのみ、右端の接続線上に配置） */}
      {!isLeaf && onToggleExpand && (
        <button
          className="flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            position: 'absolute',
            right: -10,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: `1.4px solid ${borderColor}`,
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
            width="9"
            height="9"
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
      <div className="flex items-start" style={{ gap: 6.4 }}>
        {/* チェックボックス（leafのみ有効） */}
        <button
          className="flex-shrink-0 flex items-center justify-center transition-all"
          style={{
            marginTop: 0.8,
            width: 15,
            height: 15,
            borderRadius: 4,
            border: `1.4px solid ${node.completed ? accentColor : 'var(--text-muted)'}`,
            background: node.completed ? accentColor : 'transparent',
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (isLeaf) onToggleComplete();
          }}
          title={isLeaf ? (node.completed ? '未完了に戻す' : '完了にする') : '子タスクが存在するため直接完了できません'}
        >
          {node.completed && (
            <svg width="8.5" height="8.5" viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="2">
              <polyline points="1.5,5 4,7.5 8.5,2.5" />
            </svg>
          )}
        </button>

        {/* タイトル */}
        {isEditingTitle ? (
          <textarea
            ref={titleRef}
            className="input-inline font-medium flex-1"
            value={node.title}
            autoFocus
            rows={2}
            onChange={(e) => onUpdateTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            onBlur={() => setIsEditingTitle(false)}
            onClick={(e) => e.stopPropagation()}
            style={{ fontSize: 9.6, lineHeight: 1.4 }}
          />
        ) : (
          <span
            className="font-medium flex-1"
            style={{
              fontSize: 9.6,
              lineHeight: 1.2,
              color: node.completed ? 'var(--text-muted)' : 'var(--text-primary)',
              textDecoration: node.completed ? 'line-through' : 'none',
              minWidth: 0,
              overflow: 'hidden',
              wordBreak: 'break-word',
              whiteSpace: 'pre-line',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
            title={node.title || undefined}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditingTitle(true);
              setTimeout(() => titleRef.current?.focus(), 0);
            }}
          >
            {node.title ? applyManualLineBreaks(node.title) : '（タイトルなし）'}
          </span>
        )}

        {/* 削除ボタン（rootは不可） */}
        {!isRoot && (
          <button
            className="btn-icon flex-shrink-0 opacity-0 group-hover:opacity-100"
            style={{ width: 12.8, height: 12.8, opacity: isSelected ? 1 : undefined }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="このノードを削除"
          >
            <svg width="7.2" height="7.2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
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
              className="input-inline"
              placeholder="概要メモを入力..."
              value={node.memo}
              autoFocus
              onChange={(e) => onUpdateMemo(e.target.value)}
              onBlur={() => setIsEditingMemo(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === 'Escape') setIsEditingMemo(false);
              }}
              onClick={(e) => e.stopPropagation()}
              style={{ fontSize: 9.6, color: 'var(--text-secondary)' }}
            />
          ) : (
            <p
              className="cursor-text"
              style={{
                fontSize: 9.6,
                color: node.memo ? 'var(--text-secondary)' : 'var(--text-muted)',
                minHeight: 12.8,
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
              className="flex items-center font-medium"
              style={{ gap: 3.2, fontSize: 9.6, color: dueUrgency?.accent ?? 'var(--text-primary)' }}
            >
              <span>📅</span>
              <span>期限: {formatDueDateShort(node.dueDate)}</span>
            </div>
          )}

          {/* ── 進捗バー（子がある場合のみ） */}
          {!isLeaf && (
            <div className="flex items-center" style={{ gap: 6.4, marginTop: 3.2 }}>
              <span
                className="font-medium"
                style={{
                  flex: '0 0 auto',
                  fontSize: 9.6,
                  color: isSelected
                    ? accentColor
                    : (dueUrgency?.accent ?? 'var(--text-primary)'),
                }}
              >
                {progress}%
              </span>
              <div className="progress-bar" style={{ flex: 1 }}>
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

