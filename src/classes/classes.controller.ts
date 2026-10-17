import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ClassesService, TodayClassReview } from './classes.service';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classesService: ClassesService) {}

  @Get('today')
  async getTodayClassSequence(@Query('userId') userId?: string): Promise<TodayClassReview> {
    return this.classesService.getTodayClassSequence(userId);
  }

  @Post('today/complete')
  async completeTodaySession(@Body('userId') userId?: string) {
    return this.classesService.markSessionCompleted(userId);
  }
}
