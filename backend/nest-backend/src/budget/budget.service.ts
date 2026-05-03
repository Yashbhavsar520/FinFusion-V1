import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto } from './dto/budget.dto';

@Injectable()
export class BudgetService {
  constructor(private readonly prisma: PrismaService) {}

  async createBudget(userId: string, dto: CreateBudgetDto) {
    if (dto.limit <= 0) throw new BadRequestException('Limit must be > 0');
    const category = dto.category?.trim() || 'General';

    return this.prisma.budget.upsert({
      where: { userId_month_year_category: { userId, month: dto.month, year: dto.year, category } },
      update: { limit: dto.limit },
      create: { userId, limit: dto.limit, month: dto.month, year: dto.year, category },
    });
  }

  async deleteBudget(userId: string, id: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id } });
    if (!budget || budget.userId !== userId) {
      throw new BadRequestException('Budget not found');
    }
    return this.prisma.budget.delete({ where: { id } });
  }

  async getBudgetStatus(userId: string, month: number, year: number) {
    // Fetch all budgets for this user/month/year
    const budgets = await this.prisma.budget.findMany({
      where: { userId, month, year },
    });

    // Fetch all expenses for this month grouped by category
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: {
          gte: new Date(year, month - 1, 1),
          lt:  new Date(year, month, 1),
        },
      },
      select: { amount: true, category: true },
    });

    // Group spending by category
    const spentByCategory: Record<string, number> = {};
    for (const e of expenses) {
      const cat = e.category || 'General';
      spentByCategory[cat] = (spentByCategory[cat] || 0) + e.amount;
    }

    // Build per-category status
    const categoryStatus = budgets.map((b) => {
      const spent = spentByCategory[b.category] || 0;
      const remaining = b.limit - spent;
      const percentage = b.limit > 0
        ? Number(((spent / b.limit) * 100).toFixed(2))
        : 0;

      let status = 'SAFE';
      if (spent > b.limit) status = 'EXCEEDED';
      else if (spent > b.limit * 0.8) status = 'WARNING';

      return {
        id: b.id,
        category: b.category,
        limit: b.limit,
        spent,
        remaining,
        percentage,
        status,
      };
    });

    // Also report categories with spending but no budget
    const unbudgeted = Object.entries(spentByCategory)
      .filter(([cat]) => !budgets.find((b) => b.category === cat))
      .map(([category, spent]) => ({
        id: null,
        category,
        limit: 0,
        spent,
        remaining: -spent,
        percentage: null,
        status: 'NO_BUDGET',
      }));

    const totalLimit = budgets.reduce((a, b) => a + b.limit, 0);
    const totalSpent = Object.values(spentByCategory).reduce((a, b) => a + b, 0);

    return {
      month,
      year,
      totalLimit,
      totalSpent,
      totalRemaining: totalLimit - totalSpent,
      categories: [...categoryStatus, ...unbudgeted],
    };
  }

  async getSpendingHistory(userId: string, monthsBack = 6) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);

    const expenses = await this.prisma.expense.findMany({
      where: { userId, date: { gte: from } },
      select: { amount: true, category: true, date: true },
      orderBy: { date: 'asc' },
    });

    // Group by YYYY-MM and category
    const history: Record<string, Record<string, number>> = {};
    for (const e of expenses) {
      const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
      if (!history[key]) history[key] = {};
      const cat = e.category || 'General';
      history[key][cat] = (history[key][cat] || 0) + e.amount;
    }

    return history;
  }
}