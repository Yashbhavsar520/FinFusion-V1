import {
  IsString,
  IsNumber,
  IsOptional,
  IsPositive,
  IsArray,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class SplitDto {
  @IsString()
  personId: string;

  @IsNumber()
  @IsPositive()
  share: number;
}

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  category: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SplitDto)
  splits?: SplitDto[];
}
