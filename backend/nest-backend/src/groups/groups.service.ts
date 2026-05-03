import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GroupsService {
  constructor(private prisma: PrismaService) { }

  async createGroup(userId: string, name: string) {
    return this.prisma.group.create({
      data: {
        name,
        GroupMember: { create: { userId } },
      },
      include: {
        GroupMember: { include: { user: true } },
        expenses: true,
      },
    });
  }

  // groups.service.ts
  async addMember(groupId: string, name: string) {
    const bcrypt = await import('bcrypt');
    const hashed = await bcrypt.hash(Math.random().toString(36), 10);

    const user = await this.prisma.user.create({
      data: {
        name,
        email: `member_${Date.now()}_${Math.random().toString(36).slice(2)}@noreply.finfusion.internal`,
        password: hashed,
      },
    });

    const member = await this.prisma.groupMember.create({
      data: { groupId, userId: user.id },
      include: { user: true },
    });

    // ✅ Seed splits for ALL existing expenses in this group
    // The new member gets share: 0 for all pre-existing expenses
    const existingExpenses = await this.prisma.expense.findMany({
      where: { groupId },
    });

    if (existingExpenses.length > 0) {
      await this.prisma.expenseSplit.createMany({
        data: existingExpenses.map((e) => ({
          expenseId: e.id,
          userId: user.id,
          share: 0, // ✅ new member owes nothing for past expenses
        })),
        skipDuplicates: true,
      });
    }

    return member;
  }
  async findAll(userId: string) {
    return this.prisma.group.findMany({
      where: {
        GroupMember: { some: { userId } },
      },
      include: {
        expenses: {
          include: {
            splits: true, // ✅ THIS was the missing line
          },
          orderBy: { createdAt: 'desc' },
        },
        GroupMember: { include: { user: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async delete(groupId: string, userId: string) {
    const group = await this.prisma.group.findFirst({
      where: {
        id: groupId,
        GroupMember: { some: { userId } },
      },
    });

    if (!group) {
      throw new ForbiddenException('You cannot delete this group');
    }

    await this.prisma.$transaction([
      this.prisma.expense.deleteMany({ where: { groupId } }),
      this.prisma.settlement.deleteMany({ where: { groupId } }),
      this.prisma.groupMember.deleteMany({ where: { groupId } }),
      this.prisma.group.delete({ where: { id: groupId } }),
    ]);

    return { deleted: true };
  }

  async removeMember(
    groupId: string,
    targetUserId: string,
    requestingUserId: string,
  ) {
    const membership = await this.prisma.groupMember.findFirst({
      where: { groupId, userId: requestingUserId },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this group');
    }

    return this.prisma.groupMember.deleteMany({
      where: { groupId, userId: targetUserId },
    });
  }
}
