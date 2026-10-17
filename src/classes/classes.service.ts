import { Injectable, Logger } from '@nestjs/common';
import { CurriculumService } from '../curriculum/curriculum.service';
import { PracticeItem } from '../curriculum/curriculum.interface';
import { FirebaseService } from '../firebase/firebase.service';

export interface TodayClassReview {
  id: string;
  title: string;
  intent: string;
  focusSummary: string;
  sessionTime: string;
  studioRoom: string;
  curatedBy: string;
  curatorNote: string;
  estimatedDurationMinutes: number;
  completedClassmatesCount: number;
  userStreakDays: number;
  assignedItems: PracticeItem[];
}

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    private readonly curriculumService: CurriculumService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async getTodayClassSequence(userId?: string): Promise<TodayClassReview> {
    const allItems = await this.curriculumService.findAll();
    const assigned = allItems.filter((i) => i.featureInTodayClass);

    // Calculate total duration from assigned items
    const totalMinutes = assigned.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

    let streakDays = 0;
    let completedCount = 0;

    const firestore = this.firebaseService.getFirestore();
    if (firestore) {
      try {
        // Query today's completions
        const completionsSnap = await firestore.collection('practice_completions').get();
        completedCount = completionsSnap.size;

        if (userId) {
          const userDoc = await firestore.collection('users').doc(userId).get();
          if (userDoc.exists) {
            streakDays = userDoc.data()?.streakDays || 0;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Could not read completion stats from Firestore: ${err.message}`);
      }
    }

    return {
      id: 'today-class-flow',
      title: assigned.length > 0 ? (assigned[0].classSessionName || "Today's Studio Flow") : "No Active Class Assigned",
      intent: assigned.length > 0 ? "Today's Guided Sequence" : "Awaiting teacher assignments",
      focusSummary:
        assigned.length > 0
          ? "Complete your home practice sequence with mindfulness and proper breath pacing."
          : "Your instructor has not assigned any postures for today yet.",
      sessionTime: '',
      studioRoom: '',
      curatedBy: assigned.length > 0 ? (assigned[0].curatedBy || 'Instructor') : '',
      curatorNote: '',
      estimatedDurationMinutes: totalMinutes,
      completedClassmatesCount: completedCount,
      userStreakDays: streakDays,
      assignedItems: assigned,
    };
  }

  async markSessionCompleted(userId?: string): Promise<{ success: boolean; newStreak: number }> {
    const firestore = this.firebaseService.getFirestore();
    let newStreak = 1;

    if (firestore && userId) {
      try {
        const userRef = firestore.collection('users').doc(userId);
        const userDoc = await userRef.get();
        const currentStreak = userDoc.exists ? (userDoc.data()?.streakDays || 0) : 0;
        newStreak = currentStreak + 1;

        await userRef.set(
          {
            streakDays: newStreak,
            lastCompletedAt: new Date().toISOString(),
          },
          { merge: true },
        );

        await firestore.collection('practice_completions').add({
          userId,
          completedAt: new Date().toISOString(),
        });
      } catch (err: any) {
        this.logger.error(`Error logging completion in Firestore: ${err.message}`);
      }
    }

    return {
      success: true,
      newStreak,
    };
  }
}
