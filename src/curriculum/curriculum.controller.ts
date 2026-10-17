import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { CurriculumService } from './curriculum.service';
import { PracticeItem, StudioMetrics, PillarType } from './curriculum.interface';
import { FirebaseAuthGuard, RolesGuard } from '../auth/guards';
import { Roles, CurrentUser } from '../auth/decorators';
import { UserProfile } from '../auth/auth.service';

@Controller('curriculum')
export class CurriculumController {
  constructor(private readonly curriculumService: CurriculumService) {}

  @Get('metrics')
  async getMetrics(): Promise<StudioMetrics> {
    return this.curriculumService.getMetrics();
  }

  @Get()
  async findAll(
    @Query('pillar') pillar?: PillarType | 'all',
    @Query('difficulty') difficulty?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
  ): Promise<PracticeItem[]> {
    return this.curriculumService.findAll({
      pillarType: pillar,
      difficulty,
      search,
      sort,
    });
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<PracticeItem> {
    const item = await this.curriculumService.findById(id);
    if (!item) {
      throw new NotFoundException(`Practice item with ID ${id} not found`);
    }
    return item;
  }

  @Post()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  async create(
    @Body() body: Partial<PracticeItem>,
    @CurrentUser() user: UserProfile,
  ): Promise<PracticeItem> {
    if (!body.curatedBy && user) {
      body.curatedBy = user.displayName || user.email || 'Teacher';
    }
    return this.curriculumService.create(body);
  }

  @Put(':id')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<PracticeItem>,
  ): Promise<PracticeItem> {
    const updated = await this.curriculumService.update(id, body);
    if (!updated) {
      throw new NotFoundException(`Practice item with ID ${id} not found`);
    }
    return updated;
  }

  @Delete(':id')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  async remove(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.curriculumService.delete(id);
    return { success };
  }
}

