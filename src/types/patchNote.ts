export type PatchNoteType = 'feature' | 'bugfix' | 'other';

export interface PatchNote {
  id: string;
  date: string; // YYYY-MM-DD
  version: string; // 例: "v1.2.0"
  type: PatchNoteType;
  title: string;
  description: string;
  beforeImageUrl?: string | null;
  afterImageUrl?: string | null;
}

export type PatchNotesJson = PatchNote[];
