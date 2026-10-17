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
