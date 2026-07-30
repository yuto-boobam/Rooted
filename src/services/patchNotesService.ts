import patchNotesJson from '../data/patchNotes.json';
import type { PatchNote, PatchNoteType, PatchNotesJson } from '../types/patchNote';

export const PATCH_NOTES_FILE_PATH = 'src/data/patchNotes.json';

const importedPatchNotes = (
  Array.isArray(patchNotesJson) ? patchNotesJson : []
) as unknown as PatchNotesJson;

export function getInitialPatchNotes(): PatchNote[] {
  return sortPatchNotes(importedPatchNotes.map((note) => normalizePatchNote(note)));
}

export function getPatchNotesByDate(notes: PatchNote[], date: string): PatchNote[] {
  return sortPatchNotes(notes.filter((note) => note.date === date));
}

export function getPatchNoteDates(notes: PatchNote[]): string[] {
  return Array.from(new Set(sortPatchNotes(notes).map((note) => note.date)));
}

export function createEmptyPatchNote(date = todayDateKey(), notes: PatchNote[] = []): PatchNote {
  const safeDate = isDateKey(date) ? date : todayDateKey();

  return {
    id: generatePatchNoteId(safeDate),
    date: safeDate,
    version: suggestNextVersion(notes),
    type: 'other',
    title: '',
    description: '',
    beforeImageUrl: null,
    afterImageUrl: null,
  };
}

export function upsertPatchNote(notes: PatchNote[], patchNote: PatchNote): PatchNote[] {
  const normalizedPatchNote = normalizePatchNote(patchNote);
  const existingIndex = notes.findIndex((note) => note.id === normalizedPatchNote.id);

  if (existingIndex === -1) {
    return sortPatchNotes([...notes, normalizedPatchNote]);
  }

  const nextNotes = [...notes];
  nextNotes[existingIndex] = normalizedPatchNote;

  return sortPatchNotes(nextNotes);
}

export function removePatchNote(notes: PatchNote[], patchNoteId: string): PatchNote[] {
  return sortPatchNotes(notes.filter((note) => note.id !== patchNoteId));
}

export function toPatchNotesJson(notes: PatchNote[]): string {
  const normalizedNotes = sortPatchNotes(notes.map((note) => normalizePatchNote(note)));
  return `${JSON.stringify(normalizedNotes, null, 2)}\n`;
}

export async function copyPatchNotesJson(notes: PatchNote[]): Promise<void> {
  await copyTextToClipboard(toPatchNotesJson(notes));
}

export function downloadPatchNotesJson(notes: PatchNote[], filename = 'patchNotes.json'): void {
  if (typeof document === 'undefined') {
    throw new Error('この環境ではファイル保存を実行できません。');
  }

  const blob = new Blob([toPatchNotesJson(notes)], {
    type: 'application/json;charset=utf-8',
  });

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(objectUrl);
}

export function normalizePatchNote(note: Partial<PatchNote>): PatchNote {
  const rawDate = safeString(note.date);
  const date = isDateKey(rawDate) ? rawDate : todayDateKey();

  return {
    id: safeString(note.id) || generatePatchNoteId(date),
    date,
    version: safeString(note.version) || 'v0.1.0',
    type: isPatchNoteType(note.type) ? note.type : 'other',
    title: safeString(note.title) || '無題のパッチノート',
    description: safeString(note.description) || 'Why / 変更理由:\n変更理由を記入してください。',
    beforeImageUrl: optionalUrlToNull(note.beforeImageUrl),
    afterImageUrl: optionalUrlToNull(note.afterImageUrl),
  };
}

export function sortPatchNotes(notes: PatchNote[]): PatchNote[] {
  return [...notes].sort((a, b) => {
    const dateDiff = dateKeyToLocalTime(b.date) - dateKeyToLocalTime(a.date);

    if (dateDiff !== 0) {
      return dateDiff;
    }

    return compareVersionDesc(a.version, b.version);
  });
}

export function suggestNextVersion(notes: PatchNote[]): string {
  const versions = notes
    .map((note) => parseSemver(note.version))
    .filter((version): version is [number, number, number] => version !== null)
    .sort((a, b) => b[0] - a[0] || b[1] - a[1] || b[2] - a[2]);

  if (versions.length === 0) {
    return 'v0.1.0';
  }

  const [major, minor, patch] = versions[0];
  return `v${major}.${minor}.${patch + 1}`;
}

export function todayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function generatePatchNoteId(date = todayDateKey()): string {
  const cryptoApi = typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined;

  if (cryptoApi && 'randomUUID' in cryptoApi) {
    const randomUUID = (cryptoApi as Crypto & { randomUUID: () => string }).randomUUID();
    return `${date}-${randomUUID.slice(0, 8)}`;
  }

  return `${date}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isPatchNoteType(value: unknown): value is PatchNoteType {
  return value === 'feature' || value === 'bugfix' || value === 'other';
}

function optionalUrlToNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : null;
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateKeyToLocalTime(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  const time = new Date(year, month - 1, day).getTime();

  return Number.isFinite(time) ? time : 0;
}

function parseSemver(version: string): [number, number, number] | null {
  const matched = /^v?(\d+)\.(\d+)\.(\d+)/i.exec(version.trim());

  if (!matched) {
    return null;
  }

  return [Number(matched[1]), Number(matched[2]), Number(matched[3])];
}

function compareVersionDesc(a: string, b: string): number {
  const versionA = parseSemver(a);
  const versionB = parseSemver(b);

  if (!versionA || !versionB) {
    return b.localeCompare(a, 'ja');
  }

  return versionB[0] - versionA[0] || versionB[1] - versionA[1] || versionB[2] - versionA[2];
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard API を利用できません。');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';

  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('クリップボードへのコピーに失敗しました。');
  }
}
