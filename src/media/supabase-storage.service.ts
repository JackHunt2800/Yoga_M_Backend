import { Injectable, Logger, BadRequestException } from '@nestjs/common';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadResult {
  url: string;
  key: string;
  fileName: string;
  size: number;
  mimetype: string;
  isAudio: boolean;
  provider: 'supabase' | 'local';
}

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private supabase: SupabaseClient | null = null;
  private bucketName: string = 'Yoga';
  private isLive = false;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const supabaseUrl = process.env.SUPABASE_URL;
    // Prefer service_role key (bypasses RLS) over anon key for backend usage
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.SUPABASE_KEY;
    const supabaseKey = serviceRoleKey || anonKey;
    this.bucketName = process.env.SUPABASE_BUCKET_NAME || 'Yoga';

    if (supabaseUrl && supabaseKey) {
      if (!serviceRoleKey && anonKey) {
        this.logger.warn(
          'Using SUPABASE_KEY (anon key) instead of SUPABASE_SERVICE_ROLE_KEY. ' +
          'Storage uploads may fail with "row-level security policy" errors. ' +
          'Set SUPABASE_SERVICE_ROLE_KEY in .env with your service_role key from Supabase Dashboard → Project Settings → API.',
        );
      }
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        });
        this.isLive = true;
        this.logger.log(
          `Supabase Storage client initialized for bucket "${this.bucketName}" at ${supabaseUrl} ` +
          `(using ${serviceRoleKey ? 'service_role' : 'anon'} key)`,
        );
      } catch (err: any) {
        this.logger.error(`Failed to initialize Supabase client: ${err.message}`);
      }
    } else {
      this.logger.warn(
        'Supabase Storage credentials (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) not found in .env. Falling back to local storage (uploads/) until credentials are provided.',
      );
    }
  }

  get isConfigured(): boolean {
    return this.isLive && !!this.supabase;
  }

  async upload(
    fileBuffer: Buffer,
    originalName: string,
    mimetype: string,
  ): Promise<UploadResult> {
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds the maximum limit of 5MB.');
    }

    const isAudio = mimetype.startsWith('audio/') || originalName.endsWith('.mp3');
    const folder = isAudio ? 'audio' : 'images';
    const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${folder}/${Date.now()}-${cleanName}`;


    // 1. Try Supabase Storage if configured
    if (this.isLive && this.supabase) {
      try {
        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .upload(filePath, fileBuffer, {
            contentType: mimetype,
            upsert: true,
          });

        if (error) {
          throw error;
        }

        // Get public URL
        const { data: publicUrlData } = this.supabase.storage
          .from(this.bucketName)
          .getPublicUrl(filePath);

        this.logger.log(`Uploaded file to Supabase Storage: ${publicUrlData.publicUrl}`);

        return {
          url: publicUrlData.publicUrl,
          key: filePath,
          fileName: originalName,
          size: fileBuffer.length,
          mimetype,
          isAudio,
          provider: 'supabase',
        };
      } catch (err: any) {
        this.logger.error(`Supabase upload error: ${err.message}. Using local storage fallback.`);
      }
    }

    // 2. Local storage fallback
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const localFilename = `${Date.now()}-${cleanName}`;
    const localPath = path.join(uploadsDir, localFilename);
    fs.writeFileSync(localPath, fileBuffer);

    return {
      url: `/uploads/${localFilename}`,
      key: localFilename,
      fileName: originalName,
      size: fileBuffer.length,
      mimetype,
      isAudio,
      provider: 'local',
    };
  }

  async delete(filePath: string): Promise<boolean> {
    if (this.isLive && this.supabase) {
      try {
        const { error } = await this.supabase.storage
          .from(this.bucketName)
          .remove([filePath]);

        if (error) throw error;
        return true;
      } catch (err: any) {
        this.logger.error(`Error deleting from Supabase Storage: ${err.message}`);
      }
    }
    return false;
  }
}
