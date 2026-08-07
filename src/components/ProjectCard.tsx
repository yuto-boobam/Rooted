import type { Project } from '../types';

type Props = {
  project: Project;
  onOpen: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
};

/** 日付文字列を「YYYY/MM/DD HH:mm」形式にフォーマットする */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ProjectCard({ project, onOpen, onDelete, onToggleStar }: Props) {
  const { title, description, icon, color, starred, progress, updatedAt } = project;

  return (
    <div
      className="card group relative cursor-pointer flex flex-col gap-4 p-6 animate-fadeIn"
      style={{ '--card-color': color } as React.CSSProperties}
      onClick={onOpen}
    >
      {/* 上部：アイコン＋タイトル（隣接配置でコンパクトに） */}
      {/* ボタン群はホバー時のみ絶対配置で重ねて表示し、通常時にタイトル幅を圧迫しないようにする */}
      <div className="flex items-center gap-2 min-w-0 pr-12">
        {/* カラー付きアイコン */}
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{ background: `${color}22`, border: `1px solid ${color}44` }}
        >
          {icon}
        </div>

        {/* タイトル（1行省略） */}
        <h2
          className="font-semibold text-sm truncate min-w-0"
          style={{ color: 'var(--text-primary)' }}
          title={title}
        >
          {title}
        </h2>
      </div>

      {/* ボタン群（ホバー時にカード右上へ重ねて表示） */}
      <div
        className="absolute top-6 right-6 flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()} // カード全体のクリックを止める
      >
          {/* スターボタン */}
          <button
            id={`star-${project.id}`}
            className="btn-icon"
            onClick={onToggleStar}
            title={starred ? 'お気に入り解除' : 'お気に入りに追加'}
          >
            <span style={{ color: starred ? '#eab308' : undefined, fontSize: 16 }}>
              {starred ? '★' : '☆'}
            </span>
          </button>

          {/* 削除ボタン */}
          <button
            id={`delete-project-${project.id}`}
            className="btn-icon"
            onClick={onDelete}
            title="プロジェクトを削除"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14H6L5 6" />
              <path d="M10 11v6M14 11v6" />
              <path d="M9 6V4h6v2" />
            </svg>
          </button>
      </div>

      {/* 説明文（1行省略、高さを揃えるため常に表示） */}
      <p
        className="text-xs truncate"
        style={{
          color: description ? 'var(--text-secondary)' : 'var(--text-muted)',
          fontStyle: description ? 'normal' : 'italic',
        }}
        title={description || undefined}
      >
        {description || '説明なし'}
      </p>

      {/* プログレスバー */}
      <div className="mt-auto flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>進捗</span>
          <span className="text-xs font-medium" style={{ color }}>{progress}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-bar__fill"
            style={{ width: `${progress}%`, background: color }}
          />
        </div>
      </div>

      {/* 最終更新日時 */}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        最終更新: {formatDate(updatedAt)}
      </p>

      {/* ホバー時の左側ボーダーアクセント */}
      <div
        className="absolute left-0 top-4 bottom-4 w-0.5 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: color }}
      />
    </div>
  );
}
