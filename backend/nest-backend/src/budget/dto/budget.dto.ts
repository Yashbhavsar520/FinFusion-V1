import { IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateBudgetDto {
  @IsNumber()
  @Min(1)
  limit: number;

  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @IsNumber()
  year: number;

  @IsString()
  @IsOptional()
  category?: string;
}