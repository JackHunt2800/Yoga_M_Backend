import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { SupabaseStorageService } from './supabase-storage.service';

@Module({
  controllers: [MediaController],
  providers: [SupabaseStorageService],
  exports: [SupabaseStorageService],
})
export class MediaModule {}
