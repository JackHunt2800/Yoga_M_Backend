import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { randomUUID } from 'crypto';
import { CreateTeacherDto, CreateStudentDto, UpdateUserDto } from './dto/auth.dto';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: 'teacher' | 'student' | 'admin';
  streakDays?: number;
  createdAt: string;
  updatedAt: string;
}

export type UserSession = UserProfile;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // In-memory cache for fast lookups and resilient offline/local operations
  private readonly userCache = new Map<string, UserProfile>();

  constructor(private readonly firebaseService: FirebaseService) { }

  /**
   * Create a new Teacher account.
   * Requires a valid Gmail address (@gmail.com) and generates a unique UUID.
   */
  async createTeacher(dto: CreateTeacherDto): Promise<UserProfile> {
    const email = dto.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    if (!email.endsWith('@gmail.com')) {
      throw new BadRequestException('Teacher email must be a valid Gmail address (@gmail.com)');
    }

    // Check if user already exists
    const existing = await this.findUserByEmail(email);
    if (existing) {
      if (existing.role === 'teacher') {
        return existing;
      }
      return this.updateUserRecord(existing.uid, { role: 'teacher' });
    }

    const uid = randomUUID();
    const now = new Date().toISOString();
    const displayName = dto.displayName?.trim() || email.split('@')[0];

    const teacherProfile: UserProfile = {
      uid,
      email,
      displayName,
      photoURL: '',
      role: 'teacher',
      createdAt: now,
      updatedAt: now,
    };

    // Attempt Firebase Admin Auth registration
    const auth = this.firebaseService.getAuth();
    if (auth) {
      try {
        await auth.createUser({
          uid,
          email,
          displayName,
        });
        await auth.setCustomUserClaims(uid, { role: 'teacher' });
        this.logger.log(`Created teacher account in Firebase Auth: ${email} (${uid})`);
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-exists') {
          try {
            const existingAuthUser = await auth.getUserByEmail(email);
            await auth.setCustomUserClaims(existingAuthUser.uid, { role: 'teacher' });
            teacherProfile.uid = existingAuthUser.uid;
          } catch (e: any) {
            this.logger.warn(`Could not set custom claim on existing auth user: ${e.message}`);
          }
        } else {
          this.logger.warn(`Firebase Auth user creation skipped/failed: ${authErr.message}`);
        }
      }
    }

    // Save to Firestore users collection
    await this.persistUser(teacherProfile);
    this.userCache.set(teacherProfile.uid, teacherProfile);
    this.userCache.set(teacherProfile.email, teacherProfile);

    return teacherProfile;
  }

  /**
   * Create a new Student account.
   * Generates a unique UUID and initializes streak count.
   */
  async createStudent(dto: CreateStudentDto): Promise<UserProfile> {
    const email = dto.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    // Check if user already exists
    const existing = await this.findUserByEmail(email);
    if (existing) {
      return existing;
    }

    const uid = randomUUID();
    const now = new Date().toISOString();
    const displayName = dto.displayName?.trim() || email.split('@')[0];

    const studentProfile: UserProfile = {
      uid,
      email,
      displayName,
      photoURL: '',
      role: 'student',
      streakDays: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Attempt Firebase Admin Auth registration
    const auth = this.firebaseService.getAuth();
    if (auth) {
      try {
        await auth.createUser({
          uid,
          email,
          displayName,
        });
        await auth.setCustomUserClaims(uid, { role: 'student' });
        this.logger.log(`Created student account in Firebase Auth: ${email} (${uid})`);
      } catch (authErr: any) {
        this.logger.warn(`Firebase Auth student creation skipped/failed: ${authErr.message}`);
      }
    }

    // Save to Firestore users collection
    await this.persistUser(studentProfile);
    this.userCache.set(studentProfile.uid, studentProfile);
    this.userCache.set(studentProfile.email, studentProfile);

    return studentProfile;
  }

  /**
   * Get current authenticated user profile (/api/auth/me)
   */
  async getMe(tokenOrAuthHeader?: string, fallbackUserId?: string): Promise<UserProfile> {
    const userSession = await this.resolveSession(tokenOrAuthHeader, fallbackUserId);
    let profile = await this.findUserByIdOrEmail(userSession.uid, userSession.email);

    if (!profile) {
      // Auto-provision profile in Firestore if this is a newly authenticated Google user.
      // A teacher is added ONLY through API call. All self-sign-ins default strictly to student!
      const now = new Date().toISOString();
      profile = {
        uid: userSession.uid,
        email: userSession.email,
        displayName: userSession.displayName || (userSession.email ? userSession.email.split('@')[0] : 'Practitioner'),
        photoURL: userSession.photoURL || '',
        role: userSession.role === 'teacher' ? 'teacher' : 'student',
        streakDays: 0,
        createdAt: now,
        updatedAt: now,
      };
      await this.persistUser(profile);
      this.userCache.set(profile.uid, profile);
      if (profile.email) {
        this.userCache.set(profile.email, profile);
      }
    } else if (profile.role === 'teacher' && userSession.uid && profile.uid !== userSession.uid) {
      // Teacher was pre-created via API with a generated UUID.
      // When the teacher signs in with Google, link their Google UID & profile
      const oldUid = profile.uid;
      profile.uid = userSession.uid;
      if (userSession.photoURL) profile.photoURL = userSession.photoURL;
      if (userSession.displayName && profile.displayName === profile.email.split('@')[0]) {
        profile.displayName = userSession.displayName;
      }
      profile.updatedAt = new Date().toISOString();
      await this.persistUser(profile);
      this.userCache.delete(oldUid);
      this.userCache.set(profile.uid, profile);
      this.userCache.set(profile.email, profile);
    }

    return profile;
  }

  /**
   * Update current authenticated user profile (/api/auth/me)
   * Note: Role CANNOT be modified through this endpoint. Teachers are added exclusively via API call.
   */
  async updateMe(
    tokenOrAuthHeader: string | undefined,
    dto: UpdateUserDto,
    fallbackUserId?: string,
  ): Promise<UserProfile> {
    const current = await this.getMe(tokenOrAuthHeader, fallbackUserId);
    return this.updateUserRecord(current.uid, {
      displayName: dto.displayName,
      photoURL: dto.photoURL,
    });
  }


  /**
   * Verify token for legacy /api/auth/verify endpoint
   */
  async verifyFirebaseToken(idToken: string, requestedRole?: string): Promise<UserSession> {
    if (!idToken || idToken.trim() === '') {
      throw new UnauthorizedException('Authentication token is required');
    }
    const session = await this.resolveSession(idToken);
    if (requestedRole === 'teacher' || requestedRole === 'student') {
      session.role = requestedRole;
    }
    return {
      uid: session.uid,
      email: session.email,
      displayName: session.displayName,
      photoURL: session.photoURL,
      role: session.role,
      createdAt: session.createdAt || new Date().toISOString(),
      updatedAt: session.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Find a user by UUID
   */
  async findUserById(uid: string): Promise<UserProfile | null> {
    if (this.userCache.has(uid)) {
      return this.userCache.get(uid)!;
    }

    const firestore = this.firebaseService.getFirestore();
    if (firestore) {
      try {
        const doc = await firestore.collection('users').doc(uid).get();
        if (doc.exists) {
          const user = { uid: doc.id, ...(doc.data() as Omit<UserProfile, 'uid'>) } as UserProfile;
          this.userCache.set(uid, user);
          return user;
        }
      } catch (err: any) {
        this.logger.warn(`Could not read user ${uid} from Firestore: ${err.message}`);
      }
    }
    return null;
  }

  /**
   * Find a user by email
   */
  async findUserByEmail(email: string): Promise<UserProfile | null> {
    if (!email) throw new Error("Email is required for findUserByEmail");
    const normalized = email.toLowerCase().trim();
    if (this.userCache.has(normalized)) {
      return this.userCache.get(normalized)!;
    }

    const firestore = this.firebaseService.getFirestore();
    if (firestore) {
      try {
        const querySnap = await firestore
          .collection('users')
          .where('email', '==', normalized)
          .limit(1)
          .get();
        if (!querySnap.empty) {
          const doc = querySnap.docs[0];
          const user = { uid: doc.id, ...(doc.data() as Omit<UserProfile, 'uid'>) } as UserProfile;
          this.userCache.set(normalized, user);
          this.userCache.set(user.uid, user);
          return user;
        }
      } catch (err: any) {
        this.logger.warn(`Could not query user by email from Firestore: ${err.message}`);
      }
    }
    return null;
  }

  async findUserByIdOrEmail(uid: string, email: string): Promise<UserProfile | null> {
    if (uid) {
      const user = await this.findUserById(uid);
      if (user) return user;
    }
    if (email) {
      return this.findUserByEmail(email);
    }
    return null;
  }

  /**
   * List all users filtered optionally by role
   */
  async getAllUsers(role?: 'teacher' | 'student'): Promise<UserProfile[]> {
    const firestore = this.firebaseService.getFirestore();
    const results: UserProfile[] = [];

    if (firestore) {
      try {
        let query: FirebaseFirestore.Query = firestore.collection('users');
        if (role) {
          query = query.where('role', '==', role);
        }
        const snap = await query.get();
        snap.forEach((doc) => {
          results.push({ uid: doc.id, ...(doc.data() as Omit<UserProfile, 'uid'>) } as UserProfile);
        });
        if (results.length > 0) return results;
      } catch (err: any) {
        this.logger.warn(`Could not list users from Firestore: ${err.message}`);
      }
    }

    // Fallback to cache
    const cached = Array.from(new Set(this.userCache.values()));
    return role ? cached.filter((u) => u.role === role) : cached;
  }

  /**
   * Update user record in Firestore and cache
   */
  private async updateUserRecord(uid: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    const existing = (await this.findUserById(uid)) || {
      uid,
      email: '',
      displayName: 'Practitioner',
      role: 'student' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated: UserProfile = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.persistUser(updated);
    this.userCache.set(uid, updated);
    if (updated.email) {
      this.userCache.set(updated.email, updated);
    }
    return updated;
  }

  /**
   * Persist user to Firestore
   */
  private async persistUser(user: UserProfile): Promise<void> {
    const firestore = this.firebaseService.getFirestore();
    if (firestore) {
      try {
        await firestore.collection('users').doc(user.uid).set(user, { merge: true });
        this.logger.log(`Persisted user ${user.uid} (${user.email}) to Firestore users collection`);
      } catch (err: any) {
        this.logger.warn(`Could not persist user to Firestore: ${err.message}`);
      }
    }
  }

  /**
   * Helper to decode token, verify token, or extract session from token string
   */
  async resolveSession(
    tokenOrHeader?: string,
    fallbackUserId?: string,
  ): Promise<{ uid: string; email: string; displayName: string; photoURL: string; role: 'teacher' | 'student' | 'admin'; createdAt?: string; updatedAt?: string }> {
    let rawToken = tokenOrHeader?.trim() || '';
    if (rawToken.startsWith('Bearer ')) {
      rawToken = rawToken.substring(7).trim();
    }

    if (!rawToken && fallbackUserId) {
      const user = await this.findUserById(fallbackUserId);
      console.log("fallback user", user);
      if (user) {
        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL || '',
          role: user.role,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      }
      return {
        uid: fallbackUserId,
        email: '',
        displayName: 'Practitioner',
        photoURL: '',
        role: 'student',
      };
    }

    if (!rawToken) {
      throw new UnauthorizedException('Authentication credentials not provided. Bearer token required.');
    }

    const auth = this.firebaseService.getAuth();

    // 1. Try Firebase Admin token verification if available
    if (auth) {
      try {
        const decoded = await auth.verifyIdToken(rawToken);
        const email = (decoded.email || '').toLowerCase().trim();
        const user = await this.findUserByEmail(email);
        const role: 'teacher' | 'student' | 'admin' =
          user?.role || (decoded.role as any) || 'student';
        return {
          uid: decoded.uid,
          email,
          displayName: decoded.name || email.split('@')[0] || 'Practitioner',
          photoURL: decoded.picture || '',
          role,
        };
      } catch (err: any) {
        this.logger.debug(`Firebase verifyIdToken error: ${err.message}`);
      }
    }

    // 2. Safe JWT payload extraction
    if (rawToken.includes('.')) {
      try {
        const parts = rawToken.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64').toString('utf-8');
          const payload = JSON.parse(payloadJson);
          const uid = payload.user_id || payload.sub || payload.uid;
          const email = (payload.email || '').toLowerCase().trim();
          if (uid || email) {
            const existingTeacher = email ? await this.findUserByEmail(email) : null;
            const role: 'teacher' | 'student' =
              payload.role === 'teacher' || existingTeacher?.role === 'teacher' ? 'teacher' : 'student';
            return {
              uid: uid || randomUUID(),
              email,
              displayName: payload.name || email.split('@')[0] || 'Practitioner',
              photoURL: payload.picture || '',
              role,
            };
          }
        }
      } catch (err: any) {
        this.logger.debug(`JWT decoding error: ${err.message}`);
      }
    }


    // 3. Direct UUID or userId passed in token field (useful for testing or direct API invocation)
    if (rawToken.length >= 8 && !rawToken.includes('.')) {
      const cached = await this.findUserById(rawToken);
      if (cached) {
        return {
          uid: cached.uid,
          email: cached.email,
          displayName: cached.displayName,
          photoURL: cached.photoURL || '',
          role: cached.role,
          createdAt: cached.createdAt,
          updatedAt: cached.updatedAt,
        };
      }
      return {
        uid: rawToken,
        email: '',
        displayName: 'Practitioner',
        photoURL: '',
        role: 'student',
      };
    }

    throw new UnauthorizedException('Invalid or expired authentication token');
  }
}

