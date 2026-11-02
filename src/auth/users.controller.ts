import {
  Controller,
  Get,
  Put,
  Patch,
  Post,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService, UserProfile } from './auth.service';
import { CreateTeacherDto, CreateStudentDto, UpdateUserDto } from './dto/auth.dto';
import { FirebaseAuthGuard, RolesGuard } from './guards';
import { Roles } from './decorators';

@Controller('users')
export class UsersController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Get current authenticated user profile
   * Endpoint: GET /api/users/me
   */
  @Get('me')
  @UseGuards(FirebaseAuthGuard)
  async getMe(
    @Headers('authorization') authHeader?: string,
    @Query('token') tokenQuery?: string,
    @Query('userId') userIdQuery?: string,
  ): Promise<UserProfile> {
    const token = authHeader || tokenQuery || '';
    return this.authService.getMe(token, userIdQuery);
  }

  /**
   * Full update current user profile
   * Endpoint: PUT /api/users/me
   */
  @Put('me')
  @UseGuards(FirebaseAuthGuard)
  async updateMe(
    @Body() dto: UpdateUserDto,
    @Headers('authorization') authHeader?: string,
    @Query('token') tokenQuery?: string,
    @Query('userId') userIdQuery?: string,
  ): Promise<UserProfile> {
    const token = authHeader || tokenQuery || '';
    return this.authService.updateMe(token, dto, userIdQuery);
  }

  /**
   * Partial update current user profile
   * Endpoint: PATCH /api/users/me
   */
  @Patch('me')
  @UseGuards(FirebaseAuthGuard)
  async patchMe(
    @Body() dto: UpdateUserDto,
    @Headers('authorization') authHeader?: string,
    @Query('token') tokenQuery?: string,
    @Query('userId') userIdQuery?: string,
  ): Promise<UserProfile> {
    const token = authHeader || tokenQuery || '';
    return this.authService.updateMe(token, dto, userIdQuery);
  }

  /**
   * Create a new Teacher account (Teacher/Admin only).
   * Email must be a Gmail address (@gmail.com).
   * Endpoint: POST /api/users/teacher
   */
  @Post('teacher')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  @HttpCode(HttpStatus.CREATED)
  async createTeacher(@Body() dto: CreateTeacherDto): Promise<UserProfile> {
    return this.authService.createTeacher(dto);
  }

  /**
   * Create a new Student account.
   * Endpoint: POST /api/users/student
   */
  @Post('student')
  @HttpCode(HttpStatus.CREATED)
  async createStudent(@Body() dto: CreateStudentDto): Promise<UserProfile> {
    return this.authService.createStudent(dto);
  }

  /**
   * List users, optionally filtered by role (Teacher/Admin only)
   * Endpoint: GET /api/users?role=teacher|student
   */
  @Get()
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  async listUsers(@Query('role') role?: 'teacher' | 'student'): Promise<UserProfile[]> {
    return this.authService.getAllUsers(role);
  }
}
