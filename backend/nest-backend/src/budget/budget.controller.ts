import { Controller, Get, Post, Delete, Body, Req, Query, Param, UseGuards } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { CreateBudgetDto } from './dto/budget.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateBudgetDto) {
    return this.budgetService.createBudget(req.user.id, dto);
  }

  @Delete(':id')
  remove(@Req() req, @Param('id') id: string) {
    return this.budgetService.deleteBudget(req.user.id, id);
  }

  @Get('status')
  getStatus(
    @Req() req,
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.budgetService.getBudgetStatus(
      req.user.id,
      Number(month),
      Number(year),
    );
  }

  @Get('history')
  getHistory(@Req() req, @Query('months') months: string) {
    return this.budgetService.getSpendingHistory(
      req.user.id,
      Number(months) || 6,
    );
  }
}