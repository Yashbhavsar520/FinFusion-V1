import { Controller, Post, Body } from '@nestjs/common';
import { SummaryService } from './summary.service';

@Controller('summary')
export class SummaryController {
  constructor(private readonly summaryService: SummaryService) {}

  @Post()
  getSummary(@Body() body: any) {
    return this.summaryService.getSummary(body);
  }
}
