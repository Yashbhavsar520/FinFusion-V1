import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ExpensesService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    title?: string;
    amount: number;
    category: string;
    userId: string;
    groupId?: string;
    date?: string;                  
    splits?: { personId: string; share: number }[];
  }) {
    if (data.amount <= 0) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          title:    data.title ?? 'Expense',
          amount:   Number(data.amount),
          category: data.category,
          userId:   data.userId,
          groupId:  data.groupId || null,
          date:     data.date ? new Date(data.date) : new Date(),
        },
      });

      if (data.groupId && data.splits && data.splits.length > 0) {
        await tx.expenseSplit.createMany({
          data: data.splits.map((s) => ({
            expenseId: expense.id,
            userId:    s.personId,
            share:     Number(s.share),
          })),
          skipDuplicates: true,
        });

        const allMembers = await tx.groupMember.findMany({
          where: { groupId: data.groupId },
        });

        const coveredUserIds = new Set(data.splits.map((s) => s.personId));
        const missingMembers = allMembers.filter(
          (m) => !coveredUserIds.has(m.userId)
        );

        if (missingMembers.length > 0) {
          await tx.expenseSplit.createMany({
            data: missingMembers.map((m) => ({
              expenseId: expense.id,
              userId:    m.userId,
              share:     0,
            })),
            skipDuplicates: true,
          });
        }
      }

      return tx.expense.findUnique({
        where: { id: expense.id },
        include: { splits: true },
      });
    });
  }

  getUserExpenses(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    return this.prisma.expense.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { splits: true },
      skip,
      take: limit,
    });
  }

  async deleteExpense(id: string, userId: string) {
    const expense = await this.prisma.expense.findUnique({ where: { id } });

    if (!expense) throw new NotFoundException('Expense not found');
    if (expense.userId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to delete this expense',
      );
    }

    return this.prisma.expense.delete({ where: { id } });
  }

  async backfillSplits(groupId: string) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        groupId,
        splits: { none: {} },
      },
      include: {
        group: {
          include: {
            GroupMember: true,
          },
        },
      },
    });

    for (const expense of expenses) {
      if (!expense.group) continue;

      const members = expense.group.GroupMember;
      if (members.length === 0) continue;

      const share = Number((expense.amount / members.length).toFixed(2));
      const shares = members.map((m, i) => ({
        expenseId: expense.id,
        userId:    m.userId,
        share:
          i === members.length - 1
            ? Number((expense.amount - share * (members.length - 1)).toFixed(2))
            : share,
      }));

      await this.prisma.expenseSplit.createMany({
        data: shares,
        skipDuplicates: true,
      });
    }
  }

  async scanReceipt(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    try {
      const FormData = (await import('form-data')).default;
      const fetch    = (await import('node-fetch')).default;

      const form = new FormData();
      form.append('file', file.buffer, {
        filename:    file.originalname || 'receipt.jpg',
        contentType: file.mimetype,
      });

      const ML_URL   = process.env.ML_SERVICE_URL || 'http://localhost:8000';
      const response = await fetch(`${ML_URL}/scan-receipt`, {
        method:  'POST',
        body:    form,
        headers: form.getHeaders(),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('ML service error:', err);
        throw new Error(`ML service returned ${response.status}`);
      }

      const data = await response.json() as {
        amount:      number;
        description: string;
        category:    string;
      };

      return {
        amount:      data.amount,
        description: data.description,
        category:    data.category,
      };
    } catch (err) {
      console.error('Receipt scan failed:', err);
      throw new BadRequestException('Failed to scan receipt. Please try again.');
    }
  }
}