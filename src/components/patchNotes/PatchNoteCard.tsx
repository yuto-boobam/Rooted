import type { CSSProperties } from 'react';
import type { PatchNote, PatchNoteType } from '../../types/patchNote';

interface PatchNoteCardProps {
  note: PatchNote;
  showDate?: boolean;
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

export default function PatchNoteCard({ note, showDate = false }: PatchNoteCardProps) {
  const typeMeta = TYPE_META[note.type];
  const hasImages = Boolean(note.beforeImageUrl || note.afterImageUrl);

  return (
    <article style={styles.noteCard}>
      <div style={styles.noteHeader}>
        <div>
          <div style={styles.versionRow}>
            <span style={styles.version}>第{note.buildNumber}回更新</span>

            {showDate && (
              <span style={styles.dateBadge}>（{formatDateLabelSlash(note.date)}）</span>
            )}

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

function formatDateLabelSlash(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');

  if (!year || !month || !day) {
    return dateKey;
  }

  return `${year}/${Number(month)}/${Number(day)}`;
}

const styles: Record<string, CSSProperties> = {
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
  dateBadge: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: 700,
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
};
