import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { verify } from 'argon2';
import { PrismaService } from '../database/prisma.service.js';
import { hashPassword } from './password.js';
import type { LoginDto } from './login.dto.js';
import type { User } from '../generated/prisma/client.js';

export function publicUser(user: User) {
  return { id: user.id.toString(), username: user.username, role: user.role };
}

@Injectable()
export class AuthService {
  // Equal password work for unknown and inactive accounts; no DB required at boot.
  private readonly dummyHash = hashPassword(randomBytes(32).toString('hex'));

  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    const valid = await verify(
      user?.passwordHash ?? (await this.dummyHash),
      dto.password,
    );
    if (!valid || !user?.active)
      throw new UnauthorizedException('Credenciales inválidas.');
    return publicUser(user);
  }

  async currentUser(id: string | undefined) {
    if (!id || !/^[1-9][0-9]{0,18}$/.test(id))
      throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: BigInt(id) },
    });
    if (!user?.active) throw new UnauthorizedException();
    return publicUser(user);
  }
}
