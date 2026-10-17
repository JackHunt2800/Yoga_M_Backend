import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PracticeItem, StudioMetrics, PillarType } from './curriculum.interface';

@Injectable()
export class CurriculumService {
  private readonly logger = new Logger(CurriculumService.name);

  constructor(private readonly firebaseService: FirebaseService) {}

  async getMetrics(): Promise<StudioMetrics> {
    const firestore = this.firebaseService.getFirestore();
    const defaultMetrics: StudioMetrics = {
      activeAsanas: 0,
      totalMudras: 0,
      totalMantras: 0,
      newAsanasThisTerm: 0,
      pranaVayusCovered: '0 / 5 Complete',
      averageListenRate: '0% completion',
      studentCompletionCountToday: 0,
      foundationsCount: 0,
      intermediateCount: 0,
      advancedCount: 0,
    };

    if (!firestore) {
      return defaultMetrics;
    }

    try {
      const snapshot = await firestore.collection('curriculum_items').get();
      if (snapshot.empty) {
        return defaultMetrics;
      }

      let asanas = 0;
      let mudras = 0;
      let mantras = 0;
      let foundations = 0;
      let intermediate = 0;
      let advanced = 0;

      snapshot.forEach((doc) => {
        const data = doc.data() as PracticeItem;
        if (data.pillarType === 'asana') asanas++;
        if (data.pillarType === 'mudra') mudras++;
        if (data.pillarType === 'mantra') mantras++;
        if (data.difficulty === 'foundations') foundations++;
        if (data.difficulty === 'intermediate') intermediate++;
        if (data.difficulty === 'deepening') advanced++;
      });

      return {
        activeAsanas: asanas,
        totalMudras: mudras,
        totalMantras: mantras,
        newAsanasThisTerm: asanas,
        pranaVayusCovered: mudras > 0 ? `${Math.min(5, mudras)} / 5 Complete` : '0 / 5 Complete',
        averageListenRate: mantras > 0 ? '100% completion' : '0% completion',
        studentCompletionCountToday: 0,
        foundationsCount: foundations,
        intermediateCount: intermediate,
        advancedCount: advanced,
      };
    } catch (err: any) {
      this.logger.error('Error fetching metrics from Firestore:', err.message);
      return defaultMetrics;
    }
  }

  async findAll(params?: {
    pillarType?: PillarType | 'all';
    difficulty?: string;
    search?: string;
    sort?: string;
  }): Promise<PracticeItem[]> {
    const firestore = this.firebaseService.getFirestore();
    if (!firestore) {
      return [];
    }

    let items: PracticeItem[] = [];

    try {
      const snapshot = await firestore.collection('curriculum_items').get();
      items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<PracticeItem, 'id'>),
      }));
    } catch (e: any) {
      this.logger.error('Failed to query Firestore:', e.message);
      return [];
    }

    // Apply filters
    if (params?.pillarType && params.pillarType !== 'all') {
      items = items.filter((item) => item.pillarType === params.pillarType);
    }

    if (params?.difficulty && params.difficulty !== 'all') {
      items = items.filter((item) => item.difficulty === params.difficulty);
    }

    if (params?.search && params.search.trim() !== '') {
      const q = params.search.toLowerCase().trim();
      items = items.filter(
        (item) =>
          item.title?.toLowerCase().includes(q) ||
          item.sanskritTitle?.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.subtitle?.toLowerCase().includes(q),
      );
    }

    // Sort
    if (params?.sort === 'recent') {
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (params?.sort === 'title') {
      items.sort((a, b) => a.title.localeCompare(b.title));
    } else if (params?.sort === 'difficulty') {
      const order = { foundations: 1, intermediate: 2, deepening: 3 };
      items.sort((a, b) => (order[a.difficulty] || 2) - (order[b.difficulty] || 2));
    }

    return items;
  }

  async findById(id: string): Promise<PracticeItem | null> {
    const firestore = this.firebaseService.getFirestore();
    if (!firestore) return null;

    try {
      const doc = await firestore.collection('curriculum_items').doc(id).get();
      if (doc.exists) {
        return { id: doc.id, ...(doc.data() as Omit<PracticeItem, 'id'>) };
      }
    } catch (err: any) {
      this.logger.warn(`Failed reading item ${id} from Firestore:`, err.message);
    }

    return null;
  }

  async create(itemData: Partial<PracticeItem>): Promise<PracticeItem> {
    const id = itemData.id || `item-${Date.now()}`;
    const now = new Date().toISOString();
    const newItem: PracticeItem = {
      id,
      pillarType: itemData.pillarType || 'asana',
      title: itemData.title || '',
      sanskritTitle: itemData.sanskritTitle || '',
      subtitle: itemData.subtitle || '',
      description: itemData.description || '',
      difficulty: itemData.difficulty || 'foundations',
      imageUrl: itemData.imageUrl || '',
      imageFileName: itemData.imageFileName || '',
      imageResolution: itemData.imageResolution || '',
      imageAlt: itemData.imageAlt || '',
      audioUrl: itemData.audioUrl || '',
      audioFileName: itemData.audioFileName || '',
      audioDuration: itemData.audioDuration || '',
      audioDetails: itemData.audioDetails || '',
      alignmentCues: itemData.alignmentCues || [],
      breathPacing: itemData.breathPacing || '',
      pranicCurrent: itemData.pranicCurrent || '',
      targetChakra: itemData.targetChakra || '',
      durationMinutes: itemData.durationMinutes || 5,
      holdBreaths: itemData.holdBreaths || '',
      isPublishedToHomeHub: itemData.isPublishedToHomeHub ?? true,
      featureInTodayClass: itemData.featureInTodayClass ?? false,
      classSessionName: itemData.classSessionName || '',
      createdAt: now,
      updatedAt: now,
      curatedBy: itemData.curatedBy || '',
    };

    const firestore = this.firebaseService.getFirestore();
    if (firestore) {
      await firestore.collection('curriculum_items').doc(id).set(newItem);
      this.logger.log(`Created practice item ${id} in Firestore.`);
    } else {
      this.logger.warn(`Firestore not connected. Item ${id} was not saved to persistent database.`);
    }

    return newItem;
  }

  async update(id: string, updates: Partial<PracticeItem>): Promise<PracticeItem | null> {
    const existing = await this.findById(id);
    if (!existing) return null;

    const updated: PracticeItem = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const firestore = this.firebaseService.getFirestore();
    if (firestore) {
      await firestore.collection('curriculum_items').doc(id).update(updated as any);
      return updated;
    }

    return null;
  }

  async delete(id: string): Promise<boolean> {
    const firestore = this.firebaseService.getFirestore();
    if (firestore) {
      try {
        await firestore.collection('curriculum_items').doc(id).delete();
        return true;
      } catch (e: any) {
        this.logger.error(`Failed to delete item ${id} from Firestore:`, e.message);
      }
    }
    return false;
  }
}
