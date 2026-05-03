import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AppService } from './app.service';
import { BudgetModule } from './budget/budget.module';
import { UsersModule } from './users/users.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SettlementsService } from './settlements/settlements.service';
import { SettlementsController } from './settlements/settlements.controller';
import { SettlementsModule } from './settlements/settlements.module';
import { SummaryModule } from './summary/summary.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { GroupsModule } from './groups/groups.module';

@Module({
  imports: [
    UsersModule,
    ExpensesModule,
    AnalyticsModule,
    AuthModule,
    SettlementsModule,
    SummaryModule,
    PrismaModule,
    GroupsModule,
    BudgetModule,
  ],
  controllers: [AppController, SettlementsController],
  providers: [AppService, SettlementsService],
})
export class AppModule {}
