import { IsEmail, IsNotEmpty, IsOptional, IsString, IsNumber, Matches, IsIn } from 'class-validator';

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

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsString()
  heightUnit?: string; // 'cm' | 'ft'

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  weightUnit?: string; // 'kg' | 'lbs'

  @IsOptional()
  @IsString()
  ageRange?: string; // '18-24' | '25-34' | '35-44' | '45-54' | '55-64' | '65+'

  @IsOptional()
  @IsString()
  gender?: string; // 'female' | 'male' | 'non-binary' | 'prefer-not-to-say'
}

