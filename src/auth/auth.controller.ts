import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Body,
  Headers,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService, UserProfile, UserSession } from './auth.service';
import { CreateTeacherDto, CreateStudentDto, UpdateUserDto } from './dto/auth.dto';
import { FirebaseAuthGuard, RolesGuard } from './guards';
import { Roles } from './decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Verify Firebase token and return user session
   */
  @Post('verify')
  async verify(
    @Body('token') token?: string,
    @Body('role') role?: string,
    @Headers('authorization') authHeader?: string,
  ): Promise<UserSession> {
    const rawToken = token || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '');
    return this.authService.verifyFirebaseToken(rawToken, role);
  }

  /**
   * Create a new Teacher account (Admin/Teacher only).
   * Email must be a Gmail address (@gmail.com). A unique UUID is generated.
   * Endpoint: POST /api/auth/teacher
   */
  @Post('teacher')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  @HttpCode(HttpStatus.CREATED)
  async createTeacher(@Body() dto: CreateTeacherDto): Promise<UserProfile> {
    return this.authService.createTeacher(dto);
  }

  /**
   * Alias: POST /api/auth/create-teacher (Admin/Teacher only)
   */
  @Post('create-teacher')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createTeacherAlias(@Body() dto: CreateTeacherDto): Promise<UserProfile> {
    return this.authService.createTeacher(dto);
  }

  /**
   * Create a new Student account.
   * Generates a unique UUID and initializes practice streak.
   * Endpoint: POST /api/auth/student
   */
  @Post('student')
  @HttpCode(HttpStatus.CREATED)
  async createStudent(@Body() dto: CreateStudentDto): Promise<UserProfile> {
    return this.authService.createStudent(dto);
  }

  /**
   * Alias: POST /api/auth/create-student
   */
  @Post('create-student')
  @HttpCode(HttpStatus.CREATED)
  async createStudentAlias(@Body() dto: CreateStudentDto): Promise<UserProfile> {
    return this.authService.createStudent(dto);
  }

  /**
   * Get current authenticated user profile
   * Endpoint: GET /api/auth/me
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
   * Update current authenticated user profile
   * Endpoint: PUT /api/auth/me
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
   * Partial update for current user profile
   * Endpoint: PATCH /api/auth/me
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
   * List all registered teachers (Teachers/Admins only)
   * Endpoint: GET /api/auth/teachers
   */
  @Get('teachers')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  async getTeachers(): Promise<UserProfile[]> {
    return this.authService.getAllUsers('teacher');
  }

  /**
   * List all registered students (Teachers/Admins only)
   * Endpoint: GET /api/auth/students
   */
  @Get('students')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  async getStudents(): Promise<UserProfile[]> {
    return this.authService.getAllUsers('student');
  }

  /**
   * List users optionally filtered by role (Teachers/Admins only)
   * Endpoint: GET /api/auth/users?role=teacher
   */
  @Get('users')
  @UseGuards(FirebaseAuthGuard, RolesGuard)
  @Roles('teacher')
  async getUsers(@Query('role') role?: 'teacher' | 'student'): Promise<UserProfile[]> {
    return this.authService.getAllUsers(role);
  }
}

