import { Controller, Get, Req, UseGuards, Query, } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @UseGuards(JwtAuthGuard)
  @Get('spending')
  getSpending(@Req() req) {
    return this.analyticsService.getSpending(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('suggestions')
  getSuggestions(@Req() req) {
    return this.analyticsService.getSuggestions(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('ml-prediction')
  getPrediction(@Req() req) {
    return this.analyticsService.getMLPrediction(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
@Get('expenses/all')
getAllExpenses(
  @Req() req,
  @Query('page')      page      = '1',
  @Query('limit')     limit     = '20',
  @Query('category')  category  = 'all',
  @Query('startDate') startDate = '',
  @Query('endDate')   endDate   = '',
  @Query('sortBy')    sortBy    = 'date',
  @Query('sortOrder') sortOrder = 'desc',
) {
  return this.analyticsService.getAllExpenses(
    req.user.id,
    Number(page),
    Number(limit),
    category,
    startDate,
    endDate,
    sortBy as 'date' | 'amount',
    sortOrder as 'asc' | 'desc',
  );
}
}
