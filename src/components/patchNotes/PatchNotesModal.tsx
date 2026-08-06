import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PatchNote } from '../../types/patchNote';
import {
  getInitialPatchNotes,
  getPatchNoteDates,
  getPatchNotesByDate,
  todayDateKey,
} from '../../services/patchNotesService';
import PatchNotesCalendar from './PatchNotesCalendar';
import PatchNotesDetail from './PatchNotesDetail';
import PatchNotesEditor from './PatchNotesEditor';
import { canEditPatchNotesLocally } from '../../utils/localEditAccess';

interface PatchNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSelectedDate?: string;
}

export default function PatchNotesModal({
  isOpen,
  onClose,
  initialSelectedDate,
}: PatchNotesModalProps) {
  const [notes, setNotes] = useState<PatchNote[]>(() => getInitialPatchNotes());
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const initialNotes = getInitialPatchNotes();
    return initialSelectedDate ?? getPatchNoteDates(initialNotes)[0] ?? todayDateKey();
  });
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const canEdit = canEditPatchNotesLocally();

  useEffect(() => {
    if (isOpen && initialSelectedDate) {
      setSelectedDate(initialSelectedDate);
    }
  }, [initialSelectedDate, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setIsEditorOpen(false);
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const selectedNotes = useMemo(
    () => getPatchNotesByDate(notes, selectedDate),
    [notes, selectedDate],
  );

  const patchNoteDateCount = useMemo(() => getPatchNoteDates(notes).length, [notes]);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={styles.overlay} onMouseDown={onClose} role="presentation">
      <div
        style={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="patch-notes-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header style={styles.header}>
          <div>
            <h2 id="patch-notes-title" style={styles.title}>
              📜 パッチノート
            </h2>
            <p style={styles.subtitle}>
              src/data/patchNotes.json で管理中 / {patchNoteDateCount}日分の更新履歴
            </p>
          </div>

          <button type="button" style={styles.closeButton} onClick={onClose} aria-label="閉じる">
            ×
          </button>
        </header>

        <div style={styles.content}>
          <aside style={styles.leftPane}>
            <PatchNotesCalendar
              notes={notes}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />

            {canEdit && (
              <button
                type="button"
                style={styles.editorToggleButton}
                onClick={() => setIsEditorOpen((current) => !current)}
              >
                {isEditorOpen ? '閲覧に戻る' : '＋ パッチノート追記/編集'}
              </button>
            )}
          </aside>

          <main style={styles.rightPane}>
            {canEdit && isEditorOpen ? (
              <PatchNotesEditor
                selectedDate={selectedDate}
                notes={notes}
                onNotesChange={setNotes}
                onClose={() => setIsEditorOpen(false)}
              />
            ) : (
              <PatchNotesDetail selectedDate={selectedDate} notes={selectedNotes} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    display: 'grid',
    placeItems: 'center',
    padding: 18,
    background: 'rgba(2, 6, 23, 0.76)',
    backdropFilter: 'blur(10px)',
  },
  modal: {
    width: 'min(1080px, 100%)',
    maxHeight: 'min(860px, calc(100vh - 36px))',
    overflow: 'hidden',
    borderRadius: 22,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background:
      'linear-gradient(145deg, rgba(15, 23, 42, 0.98), rgba(2, 6, 23, 0.98))',
    boxShadow: '0 24px 90px rgba(0, 0, 0, 0.55)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 14,
    padding: '16px 18px',
    borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
  },
  title: {
    margin: 0,
    color: '#f8fafc',
    fontSize: 19,
    fontWeight: 900,
  },
  subtitle: {
    margin: '5px 0 0',
    color: '#94a3b8',
    fontSize: 12,
  },
  closeButton: {
    flex: '0 0 auto',
    width: 36,
    height: 36,
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.2)',
    background: 'rgba(30, 41, 59, 0.7)',
    color: '#e5e7eb',
    cursor: 'pointer',
    fontSize: 22,
    lineHeight: 1,
  },
  content: {
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 340px) minmax(0, 1fr)',
    gap: 16,
    padding: 16,
    overflow: 'auto',
    maxHeight: 'calc(min(860px, 100vh - 36px) - 74px)',
  },
  leftPane: {
    display: 'grid',
    alignContent: 'start',
    gap: 12,
  },
  rightPane: {
    minWidth: 0,
  },
  editorToggleButton: {
    width: '100%',
    border: '1px solid rgba(250, 204, 21, 0.35)',
    background: 'rgba(250, 204, 21, 0.1)',
    color: '#fde68a',
    borderRadius: 14,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 900,
    cursor: 'pointer',
  },
};
