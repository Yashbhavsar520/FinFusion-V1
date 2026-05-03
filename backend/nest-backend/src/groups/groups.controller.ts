import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groupsService: GroupsService) {}

  @Post()
  create(@Req() req, @Body() body: { name: string }) {
    return this.groupsService.createGroup(req.user.id, body.name);
  }

  @Get()
  findAll(@Req() req) {
    return this.groupsService.findAll(req.user.id);
  }

  @Post('add-member')
  addMember(@Body() body: { groupId: string; name: string }) {
    return this.groupsService.addMember(body.groupId, body.name);
  }

  @Delete(':id')
  delete(@Req() req, @Param('id') id: string) {
    return this.groupsService.delete(id, req.user.id);
  }
  @UseGuards(JwtAuthGuard)
  @Delete(':groupId/members/:userId')
  async removeMember(
    @Param('groupId') groupId: string,
    @Param('userId') userId: string,
    @Req() req,
  ) {
    return this.groupsService.removeMember(groupId, userId, req.user.id);
  }
}
