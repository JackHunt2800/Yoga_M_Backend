import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, IsIn } from 'class-validator';

export class CreateTeacherDto {
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @Matches(/^[a-zA-Z0-9._%+-]+@gmail\.com$/i, {
    message: 'Teacher email must be a valid Gmail address (@gmail.com)',
  })
  email: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class CreateStudentDto {
  @IsEmail({}, { message: 'Must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsString()
  photoURL?: string;
}

