import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
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
  hasCompletedToday: boolean;
  assignedItems: PracticeItem[];
}

export interface SessionCompletionResult {
  success: boolean;
  alreadyCompletedToday: boolean;
  streak: {
    current: number;
    longest: number;
  };
}

@Injectable()
export class ClassesService {
  private readonly logger = new Logger(ClassesService.name);

  constructor(
    private readonly curriculumService: CurriculumService,
    private readonly firebaseService: FirebaseService,
  ) {}

  /** Returns "YYYY-MM-DD" for a given date (defaults to now). */
  private toDateString(date: Date = new Date()): string {
    return date.toISOString().slice(0, 10);
  }

  /** Returns "YYYY-MM-DD" for yesterday. */
  private getYesterdayString(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return this.toDateString(d);
  }

  async getTodayClassSequence(userId?: string): Promise<TodayClassReview> {
    const allItems = await this.curriculumService.findAll();
    const assigned = allItems.filter((i) => i.featureInTodayClass);

    // Calculate total duration from assigned items
    const totalMinutes = assigned.reduce((acc, curr) => acc + (curr.durationMinutes || 0), 0);

    let streakDays = 0;
    let completedCount = 0;
    let hasCompletedToday = false;
    const today = this.toDateString();

    const firestore = this.firebaseService.getFirestore();
    if (firestore) {
      try {
        // Count only today's completions (not all-time)
        const completionsSnap = await firestore
          .collection('session_completions')
          .where('date', '==', today)
          .get();
        completedCount = completionsSnap.size;

        if (userId) {
          const userDoc = await firestore.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const streak = userDoc.data()?.streak;
            streakDays = streak?.current || 0;
            hasCompletedToday = streak?.lastCompletedDate === today;
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
      hasCompletedToday,
      assignedItems: assigned,
    };
  }

  async markSessionCompleted(
    userId?: string,
    completedItemIds?: string[],
  ): Promise<SessionCompletionResult> {
    const firestore = this.firebaseService.getFirestore();

    if (!firestore || !userId) {
      this.logger.warn('Cannot record completion: Firestore not connected or userId missing.');
      return { success: false, alreadyCompletedToday: false, streak: { current: 0, longest: 0 } };
    }

    const today = this.toDateString();
    const yesterday = this.getYesterdayString();

    // Fetch assigned items outside the transaction (read-only context data)
    const allItems = await this.curriculumService.findAll();
    const assigned = allItems.filter((i) => i.featureInTodayClass);
    const assignedIds = assigned.map((i) => i.id);

    // If no specific items provided, assume all assigned items were completed
    const itemsCompleted =
      completedItemIds && completedItemIds.length > 0 ? completedItemIds : assignedIds;

    try {
      const result = await firestore.runTransaction(async (tx) => {
        const userRef = firestore.collection('users').doc(userId);
        const sessionRef = firestore
          .collection('session_completions')
          .doc(`${today}_${userId}`);

        const userDoc = await tx.get(userRef);
        const streak = userDoc.exists
          ? userDoc.data()?.streak || { current: 0, longest: 0, lastCompletedDate: null }
          : { current: 0, longest: 0, lastCompletedDate: null };

        // Idempotent: already completed today — return existing streak, don't duplicate
        if (streak.lastCompletedDate === today) {
          return {
            success: true,
            alreadyCompletedToday: true,
            streak: { current: streak.current, longest: streak.longest },
          };
        }

        // Date-aware streak: continue if last completion was yesterday, reset otherwise
        const newCurrent =
          streak.lastCompletedDate === yesterday ? streak.current + 1 : 1;
        const newLongest = Math.max(streak.longest || 0, newCurrent);

        tx.set(
          userRef,
          {
            streak: {
              current: newCurrent,
              longest: newLongest,
              lastCompletedDate: today,
            },
          },
          { merge: true },
        );

        // Write session completion with deterministic ID (idempotent)
        tx.set(sessionRef, {
          userId,
          date: today,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          classSessionName:
            assigned.length > 0
              ? assigned[0].classSessionName || "Today's Studio Flow"
              : '',
          completedItemIds: itemsCompleted,
          totalItems: assignedIds.length,
          isFullCompletion: itemsCompleted.length >= assignedIds.length,
          durationMinutes: assigned.reduce(
            (acc, curr) => acc + (curr.durationMinutes || 0),
            0,
          ),
        });

        return {
          success: true,
          alreadyCompletedToday: false,
          streak: { current: newCurrent, longest: newLongest },
        };
      });

      return result;
    } catch (err: any) {
      this.logger.error(`Error recording session completion: ${err.message}`);
      return {
        success: false,
        alreadyCompletedToday: false,
        streak: { current: 0, longest: 0 },
      };
    }
  }
}
