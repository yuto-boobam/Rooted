import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { PatchNote } from '../../types/patchNote';
import { getPatchNoteDates, todayDateKey } from '../../services/patchNotesService';

interface PatchNotesCalendarProps {
  notes: PatchNote[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

type CalendarCell =
  | {
      date: string;
      day: number;
      count: number;
      isSelected: boolean;
      isToday: boolean;
    }
  | null;

const WEEK_DAYS = ['日', '月', '火', '水', '木', '金', '土'];

export default function PatchNotesCalendar({
  notes,
  selectedDate,
  onSelectDate,
}: PatchNotesCalendarProps) {
  const [displayMonth, setDisplayMonth] = useState<Date>(() => {
    const parsedDate = parseDateKey(selectedDate);
    return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
  });

  useEffect(() => {
    const parsedDate = parseDateKey(selectedDate);

    setDisplayMonth((currentMonth) => {
      if (
        currentMonth.getFullYear() === parsedDate.getFullYear() &&
        currentMonth.getMonth() === parsedDate.getMonth()
      ) {
        return currentMonth;
      }

      return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1);
    });
  }, [selectedDate]);

  const notesByDate = useMemo(() => {
    const map = new Map<string, number>();

    for (const note of notes) {
      map.set(note.date, (map.get(note.date) ?? 0) + 1);
    }

    return map;
  }, [notes]);

  const calendarCells = useMemo<CalendarCell[]>(() => {
    const year = displayMonth.getFullYear();
    const month = displayMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayDateKey();

    const cells: CalendarCell[] = [];

    for (let index = 0; index < firstDay; index += 1) {
      cells.push(null);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = toDateKey(year, month, day);

      cells.push({
        date,
        day,
        count: notesByDate.get(date) ?? 0,
        isSelected: date === selectedDate,
        isToday: date === today,
      });
    }

    return cells;
  }, [displayMonth, notesByDate, selectedDate]);

  const noteDates = useMemo(() => getPatchNoteDates(notes), [notes]);

  const moveMonth = (amount: number) => {
    setDisplayMonth(
      (currentMonth) =>
        new Date(currentMonth.getFullYear(), currentMonth.getMonth() + amount, 1),
    );
  };

  const handleTodayClick = () => {
    const today = todayDateKey();
    onSelectDate(today);
  };

  return (
    <section style={styles.panel} aria-label="パッチノートカレンダー">
      <div style={styles.header}>
        <button type="button" style={styles.navButton} onClick={() => moveMonth(-1)}>
          ‹
        </button>

        <div style={styles.monthTitle}>
          {displayMonth.getFullYear()}年 {displayMonth.getMonth() + 1}月
        </div>

        <button type="button" style={styles.navButton} onClick={() => moveMonth(1)}>
          ›
        </button>
      </div>

      <button type="button" style={styles.todayButton} onClick={handleTodayClick}>
        今日を選択
      </button>

      <div style={styles.weekGrid}>
        {WEEK_DAYS.map((weekDay) => (
          <div key={weekDay} style={styles.weekDay}>
            {weekDay}
          </div>
        ))}
      </div>

      <div style={styles.calendarGrid}>
        {calendarCells.map((cell, index) => {
          if (!cell) {
            return <div key={`empty-${index}`} style={styles.emptyCell} />;
          }

          const dayButtonStyle: CSSProperties = {
            ...styles.dayButton,
            ...(cell.isSelected ? styles.selectedDayButton : {}),
            ...(cell.count > 0 ? styles.dayWithNoteButton : {}),
            ...(cell.isToday ? styles.todayDayButton : {}),
          };

          return (
            <button
              key={cell.date}
              type="button"
              style={dayButtonStyle}
              onClick={() => onSelectDate(cell.date)}
              aria-pressed={cell.isSelected}
            >
              <span>{cell.day}</span>
              {cell.count > 0 && <span style={styles.noteDot}>{cell.count}</span>}
            </button>
          );
        })}
      </div>

      <div style={styles.timeline}>
        <div style={styles.timelineTitle}>更新がある日</div>

        {noteDates.length === 0 ? (
          <p style={styles.emptyText}>まだパッチノートがありません。</p>
        ) : (
          <div style={styles.timelineList}>
            {noteDates.slice(0, 8).map((date) => (
              <button
                key={date}
                type="button"
                style={{
                  ...styles.timelineButton,
                  ...(date === selectedDate ? styles.selectedTimelineButton : {}),
                }}
                onClick={() => onSelectDate(date)}
              >
                {formatDateLabel(date)}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function parseDateKey(dateKey: string): Date {
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);

  if (!matched) {
    return new Date();
  }

  return new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]));
}

function toDateKey(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDateLabel(dateKey: string): string {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

const styles: Record<string, CSSProperties> = {
  panel: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    borderRadius: 18,
    padding: 16,
    background: 'rgba(15, 23, 42, 0.78)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(30, 41, 59, 0.8)',
    color: '#e5e7eb',
    cursor: 'pointer',
    fontSize: 20,
    lineHeight: 1,
  },
  monthTitle: {
    color: '#f8fafc',
    fontWeight: 700,
    fontSize: 15,
  },
  todayButton: {
    width: '100%',
    marginTop: 10,
    marginBottom: 12,
    border: '1px solid rgba(250, 204, 21, 0.3)',
    background: 'rgba(250, 204, 21, 0.08)',
    color: '#fde68a',
    borderRadius: 10,
    padding: '8px 10px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
  },
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 6,
    marginBottom: 6,
  },
  weekDay: {
    color: '#94a3b8',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: 700,
  },
  calendarGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 6,
  },
  emptyCell: {
    minHeight: 42,
  },
  dayButton: {
    position: 'relative',
    minHeight: 42,
    borderRadius: 12,
    border: '1px solid rgba(148, 163, 184, 0.14)',
    background: 'rgba(2, 6, 23, 0.5)',
    color: '#cbd5e1',
    cursor: 'pointer',
    fontSize: 12,
  },
  selectedDayButton: {
    borderColor: '#facc15',
    background: 'rgba(250, 204, 21, 0.16)',
    color: '#fef3c7',
    boxShadow: '0 0 0 1px rgba(250, 204, 21, 0.12)',
  },
  dayWithNoteButton: {
    borderColor: 'rgba(59, 130, 246, 0.55)',
  },
  todayDayButton: {
    color: '#93c5fd',
  },
  noteDot: {
    position: 'absolute',
    right: 5,
    bottom: 4,
    minWidth: 16,
    height: 16,
    padding: '0 4px',
    borderRadius: 999,
    background: '#2563eb',
    color: '#fff',
    fontSize: 10,
    lineHeight: '16px',
    fontWeight: 800,
  },
  timeline: {
    marginTop: 16,
    paddingTop: 14,
    borderTop: '1px solid rgba(148, 163, 184, 0.16)',
  },
  timelineTitle: {
    color: '#e5e7eb',
    fontSize: 12,
    fontWeight: 800,
    marginBottom: 8,
  },
  timelineList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 8,
  },
  timelineButton: {
    border: '1px solid rgba(148, 163, 184, 0.18)',
    background: 'rgba(30, 41, 59, 0.65)',
    color: '#cbd5e1',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 11,
    cursor: 'pointer',
  },
  selectedTimelineButton: {
    borderColor: '#facc15',
    color: '#fde68a',
    background: 'rgba(250, 204, 21, 0.12)',
  },
  emptyText: {
    margin: 0,
    color: '#64748b',
    fontSize: 12,
  },
};
