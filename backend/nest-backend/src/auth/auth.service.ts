import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

const existingUser = await this.prisma.user.findUnique({
  where: { email },
});

if (existingUser) {
  throw new BadRequestException(
    'User already exists. Please use a different email.'
  );
}

const hashedPassword = await bcrypt.hash(dto.password, 10);

const user = await this.prisma.user.create({
  data: {
    name: dto.name,
    email, // ✅ use normalized email
    password: hashedPassword,
  },
});

    return {
      message: 'User registered successfully',
      userId: user.id,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase()},
    });

    if (!user) throw new UnauthorizedException();

    const isValid = await bcrypt.compare(dto.password, user.password);
    if (!isValid) throw new UnauthorizedException();

    const payload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
