import { Controller, Post, Body, Get, Delete, UseGuards, Req } from '@nestjs/common';
import { SettlementsService } from './settlements.service';
import { CreateSettlementDto } from './create-settlement.dto';
import { Param } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Req() req) {
    return this.settlementsService.findAll(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Body() dto: CreateSettlementDto) {
    return this.settlementsService.create(dto);
  }

  @Get(':groupId')
  findByGroup(@Param('groupId') groupId: string) {
    return this.settlementsService.findByGroup(groupId);
  }
}
