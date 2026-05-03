import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  Req,
  UseGuards,
  BadRequestException,
  Query,
} from '@nestjs/common';

import { ExpensesService } from './expenses.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { memoryStorage } from 'multer';

@Controller('expenses')
export class ExpensesController {
  constructor(private expensesService: ExpensesService) { }

  // ✅ FIX 1: scan-receipt MUST come before :id to avoid route collision
  @UseGuards(JwtAuthGuard)
  @Post('scan-receipt')
  @UseInterceptors(FileInterceptor('file'))
  scanReceipt(@UploadedFile() file: Express.Multer.File) {
    // ✅ FIX 2: guard against missing file upload
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.expensesService.scanReceipt(file);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create({
      ...dto,
      userId: dto.userId ?? req.user.id,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  getAllExpenses(
    @Req() req,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.expensesService.getUserExpenses(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  deleteExpense(@Req() req, @Param('id') id: string) {
    return this.expensesService.deleteExpense(id, req.user.id);
  }

}
