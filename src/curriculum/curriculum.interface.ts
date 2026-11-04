export type PillarType = 'asana' | 'mudra' | 'mantra';
export type DifficultyTier = 'foundations' | 'intermediate' | 'deepening';

export interface PracticeItem {
  id: string;
  pillarType: PillarType;
  title: string;
  sanskritTitle?: string;
  subtitle?: string;
  description: string;
  difficulty: DifficultyTier;
  imageUrl?: string;
  imageFileName?: string;
  imageResolution?: string;
  imageAlt?: string;
  audioUrl?: string;
  audioFileName?: string;
  audioDuration?: string;
  audioDetails?: string;
  alignmentCues?: string[];
  breathPacing?: string;
  pranicCurrent?: string;
  targetChakra?: string;
  durationMinutes?: number;
  holdBreaths?: string;
  isPublishedToHomeHub: boolean;
  featureInTodayClass: boolean;
  classSessionName?: string;
  createdAt: string;
  updatedAt: string;
  curatedBy?: string;
}

export interface Playlist {
  /** Date the playlist represents, e.g. "2026-11-04" */
  date: string;
  /** Human-friendly label derived from the date */
  label: string;
  /** Total estimated duration of all items in this playlist */
  totalDurationMinutes: number;
  /** Breakdown by pillar type */
  counts: { asana: number; mudra: number; mantra: number };
  /** Items sorted by pillar type then title */
  items: PracticeItem[];
}

export interface StudioMetrics {
  activeAsanas: number;
  totalMudras: number;
  totalMantras: number;
  newAsanasThisTerm: number;
  pranaVayusCovered: string;
  averageListenRate: string;
  studentCompletionCountToday: number;
  foundationsCount: number;
  intermediateCount: number;
  advancedCount: number;
}
