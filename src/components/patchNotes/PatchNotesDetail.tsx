import type { CSSProperties } from 'react';
import type { PatchNote, PatchNoteType } from '../../types/patchNote';

interface PatchNotesDetailProps {
  selectedDate: string;
  notes: PatchNote[];
}

const TYPE_META: Record<
  PatchNoteType,
  {
    label: string;
    color: string;
    background: string;
    border: string;
  }
> = {
  feature: {
    label: '新機能',
    color: '#bfdbfe',
    background: 'rgba(37, 99, 235, 0.18)',
    border: 'rgba(96, 165, 250, 0.42)',
  },
  bugfix: {
    label: 'バグ修正',
    color: '#fecaca',
    background: 'rgba(220, 38, 38, 0.16)',
    border: 'rgba(248, 113, 113, 0.42)',
  },
  other: {
    label: 'その他',
    color: '#ddd6fe',
    background: 'rgba(124, 58, 237, 0.16)',
    border: 'rgba(167, 139, 250, 0.42)',
  },
};

export default function PatchNotesDetail({ selectedDate, notes }: PatchNotesDetailProps) {
  if (notes.length === 0) {
    return (
      <section style={styles.emptyPanel}>
        <div style={styles.emptyIcon}>📭</div>
        <h3 style={styles.emptyTitle}>{formatDateLabel(selectedDate)} の更新履歴はありません</h3>
        <p style={styles.emptyText}>
          別の日付を選択するか、開発環境では「＋ パッチノート追記/編集」から下書きを作成できます。
        </p>
      </section>
    );
  }

  return (
    <section style={styles.panel}>
      <div style={styles.heading}>
        <span style={styles.headingIcon}>📜</span>
        <div>
          <h3 style={styles.title}>{formatDateLabel(selectedDate)} のパッチノート</h3>
          <p style={styles.subtitle}>{notes.length}件の更新</p>
        </div>
      </div>

      <div style={styles.noteList}>
        {notes.map((note) => {
          const typeMeta = TYPE_META[note.type];
          const hasImages = Boolean(note.beforeImageUrl || note.afterImageUrl);

          return (
            <article key={note.id} style={styles.noteCard}>
              <div style={styles.noteHeader}>
                <div>
                  <div style={styles.versionRow}>
                    <span style={styles.version}>第{note.buildNumber}回更新</span>
                    <span
                      style={{
                        ...styles.typeBadge,
                        color: typeMeta.color,
                        background: typeMeta.background,
                        borderColor: typeMeta.border,
                      }}
                    >
                      {typeMeta.label}
                    </span>
                  </div>

                  <h4 style={styles.noteTitle}>{note.title}</h4>
                </div>
              </div>

              <p style={styles.description}>{note.description}</p>

              {hasImages && (
                <div style={styles.imageGrid}>
                  {note.beforeImageUrl && (
                    <ImageCard label="Before" src={note.beforeImageUrl} title={note.title} />
                  )}

                  {note.afterImageUrl && (
                    <ImageCard label="After" src={note.afterImageUrl} title={note.title} />
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ImageCard({ label, src, title }: { label: string; src: string; title: string }) {
  return (
    <figure style={styles.imageCard}>
      <figcaption style={styles.imageLabel}>{label}</figcaption>
      <img
        src={src}
        alt={`${title} - ${label}`}
        style={styles.image}
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.opacity = '0.35';
        }}
      />
    </figure>
  );
}

function formatDateLabel(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');

  if (!year || !month || !day) {
    return dateKey;
  }

  return `${year}年${Number(month)}月${Number(day)}日`;
}

const styles: Record<string, CSSProperties> = {
  panel: {
    minHeight: '100%',
  },
  heading: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  headingIcon: {
    width: 40,
    height: 40,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 14,
    background: 'rgba(250, 204, 21, 0.13)',
    border: '1px solid rgba(250, 204, 21, 0.24)',
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: 800,
  },
  subtitle: {
    margin: '4px 0 0',
    color: '#94a3b8',
    fontSize: 12,
  },
  noteList: {
    display: 'grid',
    gap: 14,
  },
  noteCard: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    borderRadius: 18,
    padding: 16,
    background: 'rgba(15, 23, 42, 0.66)',
  },
  noteHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
  },
  versionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  version: {
    color: '#fde68a',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '0.03em',
  },
  typeBadge: {
    border: '1px solid',
    borderRadius: 999,
    padding: '3px 8px',
    fontSize: 11,
    fontWeight: 800,
  },
  noteTitle: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 16,
    lineHeight: 1.45,
  },
  description: {
    margin: '12px 0 0',
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 1.75,
    whiteSpace: 'pre-wrap',
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 12,
    marginTop: 14,
  },
  imageCard: {
    margin: 0,
    borderRadius: 14,
    overflow: 'hidden',
    border: '1px solid rgba(148, 163, 184, 0.16)',
    background: 'rgba(2, 6, 23, 0.48)',
  },
  imageLabel: {
    padding: '8px 10px',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 800,
    borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
  },
  image: {
    display: 'block',
    width: '100%',
    maxHeight: 260,
    objectFit: 'cover',
    background: '#020617',
  },
  emptyPanel: {
    minHeight: 280,
    display: 'grid',
    placeItems: 'center',
    textAlign: 'center',
    padding: 28,
    border: '1px dashed rgba(148, 163, 184, 0.22)',
    borderRadius: 18,
    background: 'rgba(15, 23, 42, 0.44)',
  },
  emptyIcon: {
    fontSize: 38,
  },
  emptyTitle: {
    margin: '12px 0 0',
    color: '#f8fafc',
    fontSize: 17,
  },
  emptyText: {
    maxWidth: 420,
    margin: '10px auto 0',
    color: '#94a3b8',
    fontSize: 13,
    lineHeight: 1.7,
  },
};
