

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

export function Breadcrumb({ items, onNavigate }: Props) {
  if (items.length === 0) return null;

  return (
    <nav
      className="flex items-center gap-1 text-sm overflow-x-auto"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      aria-label="パンくずリスト"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const pathUpToHere = items.slice(0, index + 1).map((i) => i.id);

        return (
          <span key={item.id} className="flex items-center gap-1 flex-shrink-0">
            {/* 区切り文字 */}
            {index > 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>›</span>
            )}

            {/* アイテム */}
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
              onClick={() => !isLast && onNavigate(pathUpToHere)}
              disabled={isLast}
            >
              {/* 長すぎる場合は短縮 */}
              {item.title.length > 20 ? item.title.slice(0, 20) + '…' : item.title}
            </button>
          </span>
        );
      })}
    </nav>
  );
}
