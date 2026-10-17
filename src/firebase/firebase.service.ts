import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private firebaseApp: admin.app.App | null = null;
  private isLive = false;

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    try {
      // 1. Check if already initialized
      if (admin.apps.length > 0) {
        this.firebaseApp = admin.apps[0];
        this.isLive = true;
        this.logger.log('Connected to existing Firebase Admin application.');
        return;
      }

      // 2. Check for individual credentials, service account JSON, or file path in env
      const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
      const privateKey = rawPrivateKey ? rawPrivateKey.replace(/\\n/g, '\n') : undefined;
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

      if (clientEmail && privateKey && projectId) {
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
        this.isLive = true;
        this.logger.log(`Initialized Firebase Admin with environment credentials for project: ${projectId}`);
      } else if (serviceAccountJson) {
        const credentials = JSON.parse(serviceAccountJson);
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(credentials),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
        this.isLive = true;
        this.logger.log(`Initialized Firebase Admin for project: ${credentials.project_id}`);
      } else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        const credentials = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(credentials),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
        });
        this.isLive = true;
        this.logger.log(`Initialized Firebase Admin via key file: ${serviceAccountPath}`);
      } else if (projectId) {
        // Fallback lightweight initialization
        this.firebaseApp = admin.initializeApp({
          projectId,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
        });
        this.isLive = true;
        this.logger.log(`Initialized Firebase Admin with Project ID: ${projectId}`);
      } else {
        this.logger.warn(
          'No Firebase credentials detected in environment. Running with local store. Once FIREBASE_PROJECT_ID or service account key is set in .env, live Firestore and Cloud Storage will be automatically engaged.',
        );
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK, using fallback store:', error.message);
      this.isLive = false;
    }
  }

  get isLiveFirebase(): boolean {
    return this.isLive && !!this.firebaseApp;
  }

  getFirestore(): admin.firestore.Firestore | null {
    if (this.isLive && this.firebaseApp) {
      return admin.firestore(this.firebaseApp);
    }
    return null;
  }

  getStorageBucket(): any | null {
    if (this.isLive && this.firebaseApp) {
      return admin.storage(this.firebaseApp).bucket();
    }
    return null;
  }

  getAuth(): admin.auth.Auth | null {
    if (this.isLive && this.firebaseApp) {
      return admin.auth(this.firebaseApp);
    }
    return null;
  }
}
