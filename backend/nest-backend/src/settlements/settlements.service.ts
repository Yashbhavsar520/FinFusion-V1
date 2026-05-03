import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSettlementDto } from './create-settlement.dto';

@Injectable()
export class SettlementsService {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateSettlementDto) {
    if (!data.groupId || !data.fromUser || !data.toUser || !data.amount) {
      throw new BadRequestException('Invalid settlement data');
    }

    const existing = await this.prisma.settlement.findFirst({
      where: {
        groupId: data.groupId,
        fromUser: data.fromUser,
        toUser: data.toUser,
        amount: Number(data.amount),
      },
    });

    if (existing) {
      throw new BadRequestException(
        'This settlement has already been recorded',
      );
    }

    return this.prisma.settlement.create({
      data: {
        groupId: data.groupId,
        fromUser: data.fromUser,
        toUser: data.toUser,
        amount: Number(data.amount),
      },
    });
  }

  async findAll(userId: string) {
    return this.prisma.settlement.findMany({
      where: {
        group: {
          GroupMember: { some: { userId } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByGroup(groupId: string) {
    return this.prisma.settlement.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
