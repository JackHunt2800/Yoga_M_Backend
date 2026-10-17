import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  PayloadTooLargeException,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SupabaseStorageService, UploadResult } from './supabase-storage.service';
import { FirebaseAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB in bytes

@Controller('media')
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(private readonly supabaseStorageService: SupabaseStorageService) {}

  @Post('upload')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_FILE_SIZE, // 5MB Multer limit
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File): Promise<UploadResult> {
    if (!file) {
      throw new BadRequestException('No file provided for upload');
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException('File size exceeds the maximum limit of 5MB');
    }

    return this.supabaseStorageService.upload(file.buffer, file.originalname, file.mimetype);
  }
}

