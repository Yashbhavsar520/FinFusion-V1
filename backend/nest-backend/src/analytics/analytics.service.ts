import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Helper — returns start and end of a given month
  private getMonthRange(year: number, month: number) {
    return {
      gte: new Date(year, month - 1, 1),
      lt:  new Date(year, month, 1),
    };
  }

  async getSpending(userId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // ✅ Filter by date field, current month only
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: this.getMonthRange(year, month),
      },
    });

    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    const byCategoryMap: Record<string, number> = {};
    expenses.forEach((e) => {
      const cat = e.category || 'General';
      byCategoryMap[cat] = (byCategoryMap[cat] || 0) + e.amount;
    });

    const by_category = Object.entries(byCategoryMap).map(
      ([category, amount]) => ({ category, amount })
    );

    return { total_monthly: total, by_category };
  }

  async getSuggestions(userId: string) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // ✅ Only current month expenses for suggestions
    const expenses = await this.prisma.expense.findMany({
      where: {
        userId,
        date: this.getMonthRange(year, month),
      },
      orderBy: { date: 'asc' },
    });

    const suggestions: string[] = [];
    const total = expenses.reduce((sum, e) => sum + e.amount, 0);

    const totalFood = expenses
      .filter((e) => e.category === 'Food')
      .reduce((sum, e) => sum + e.amount, 0);

    const shopping = expenses
      .filter((e) => e.category === 'Shopping')
      .reduce((sum, e) => sum + e.amount, 0);

    // ✅ Compare last 5 expenses vs monthly average
    const lastExpenses = expenses.slice(-5);
    const avgRecent =
      lastExpenses.reduce((sum, e) => sum + e.amount, 0) /
      (lastExpenses.length || 1);
    const avg = total / (expenses.length || 1);

    if (avgRecent > avg * 1.2) {
      suggestions.push('Your recent spending is increasing. Be cautious.');
    }
    if (totalFood > total * 0.4) {
      suggestions.push('You are spending a lot on Food. Try reducing it.');
    }
    if (totalFood > 0 && totalFood < total * 0.1) {
      suggestions.push('You are spending very little on food. Is this accurate?');
    }
    if (shopping > total * 0.3) {
      suggestions.push('Shopping expenses are high this month.');
    }
    if (total > 5000) {
      suggestions.push('Your total spending is high this month.');
    }
    if (suggestions.length === 0) {
      suggestions.push('Your spending looks balanced. Good job!');
    }

    return { suggestions };
  }

  async getMLPrediction(userId: string) {
    try {
      const currentMonth = new Date().getMonth() + 1;
      const res = await axios.get('http://localhost:8000/predict', {
        params: { month: currentMonth },
      });
      return res.data;
    } catch (error) {
      console.error('ML service error:', error.message);
      return { prediction: 0, message: 'ML service unavailable' };
    }
  }

  async getAllExpenses(
  userId: string,
  page: number,
  limit: number,
  category?: string,
  startDate?: string,
  endDate?: string,
  sortBy: 'date' | 'amount' = 'date',
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  const where: any = { userId };

  if (category && category !== 'all') {
    where.category = category;
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate)   where.date.lte = new Date(endDate);
  }

  const [expenses, total] = await Promise.all([
    this.prisma.expense.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    this.prisma.expense.count({ where }),
  ]);

  // ✅ Category totals for the filtered set
  const allFiltered = await this.prisma.expense.findMany({
    where,
    select: { amount: true, category: true },
  });

  const categoryTotals: Record<string, number> = {};
  let grandTotal = 0;
  for (const e of allFiltered) {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    grandTotal += e.amount;
  }

  return {
    expenses,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      grandTotal,
      categoryTotals,
      count: total,
    },
  };
}
}