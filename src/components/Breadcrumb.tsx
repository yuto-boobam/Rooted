import { truncateSegment, PATH_HEAD_TAIL_COUNT } from '../utils/taskTree';

type PathItem = {
  id: string;
  title: string;
};

type Props = {
  /** ルートからの選択パス（各ノードのIDと名前） */
  items: PathItem[];
  /** パンくずアイテムクリック時のコールバック（そこまでのパスに切り詰める） */
  onNavigate: (path: string[]) => void;
};

type Entry = { kind: 'item'; item: PathItem; index: number } | { kind: 'ellipsis' };

// このヘッダー行は横幅に余裕があり、幅の狭いサイドドロワーほどシビアに詰める
// 必要が無いため、1セグメントあたりの文字数はドロワー側（5文字）より長めにする
const SEGMENT_MAX_LENGTH = 14;

export function Breadcrumb({ items, onNavigate }: Props) {
  if (items.length === 0) return null;

  // 深い木ではフルパスをそのまま並べると際限なく伸びてしまうため、サイドドロワーの
  // パス表示（formatCompactPath）と同じ基準を採用する。4ノード以下ならすべて表示し、
  // 5ノード以上なら先頭2つ・末尾2つだけを残して中間は「…」でまとめる
  const entries: Entry[] =
    items.length <= PATH_HEAD_TAIL_COUNT * 2
      ? items.map((item, index) => ({ kind: 'item', item, index }))
      : [
          ...items
            .slice(0, PATH_HEAD_TAIL_COUNT)
            .map((item, index): Entry => ({ kind: 'item', item, index })),
          { kind: 'ellipsis' },
          ...items.slice(-PATH_HEAD_TAIL_COUNT).map(
            (item, offset): Entry => ({
              kind: 'item',
              item,
              index: items.length - PATH_HEAD_TAIL_COUNT + offset,
            }),
          ),
        ];

  return (
    <nav
      className="flex items-center gap-1 text-sm overflow-x-auto"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      aria-label="パンくずリスト"
    >
      {entries.map((entry, position) => (
        <span
          key={entry.kind === 'item' ? entry.item.id : 'ellipsis'}
          className="flex items-center gap-1 flex-shrink-0"
        >
          {/* 区切り文字 */}
          {position > 0 && (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>›</span>
          )}

          {entry.kind === 'ellipsis' ? (
            <span style={{ color: 'var(--text-muted)', fontSize: 13, padding: '2px 1px' }}>
              …
            </span>
          ) : (
            (() => {
              const { item, index } = entry;
              const isLast = index === items.length - 1;
              const pathUpToHere = items.slice(0, index + 1).map((i) => i.id);

              return (
                <button
                  className="px-1 py-0.5 rounded transition-colors"
                  style={{
                    color: isLast ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: isLast ? 600 : 400,
                    background: 'transparent',
                    border: 'none',
                    cursor: isLast ? 'default' : 'pointer',
                    fontSize: 13,
                  }}
                  title={item.title}
                  onClick={() => !isLast && onNavigate(pathUpToHere)}
                  disabled={isLast}
                >
                  {truncateSegment(item.title, SEGMENT_MAX_LENGTH)}
                </button>
              );
            })()
          )}
        </span>
      ))}
    </nav>
  );
}
