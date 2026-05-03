import { IsUUID, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSettlementDto {
  @IsUUID()
  groupId: string;

  @IsUUID()
  fromUser: string;

  @IsUUID()
  toUser: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;
}
