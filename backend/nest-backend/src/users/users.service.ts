import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

create(data: { name: string; email?: string; groupId?: string }) {
  const userData: any = {
    name: data.name,
    email: data.email ?? `${Date.now()}@temp.com`,
  };

  if (data.groupId) {
    userData.group = {
      connect: { id: data.groupId },
    };
  }

  return this.prisma.user.create({
    data: userData,
  });
}

async getMe(userId: string) {
  return this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      income: true,
    },
  });
}

async updateName(userId: string, name: string) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { name },
  });
}

async updateIncome(userId: string, income: number) {
  return this.prisma.user.update({
    where: { id: userId },
    data: { income },
  });
}

async changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new NotFoundException('User not found');
  }

  const isValid = await bcrypt.compare(oldPassword, user.password);

  if (!isValid) {
    throw new BadRequestException('Old password is incorrect');
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  return this.prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });
}
  getUsers() {
    return this.prisma.user.findMany();
  }
}
