import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/services/audit-log.service';
import { PermissionsResolverService } from '../common/services/permissions-resolver.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RegisterRequestDto } from './dto/register-request.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_TOKEN_TTL_DAYS = 30;
const ACCESS_TOKEN_TTL = '15m';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly auditLog: AuditLogService,
    private readonly permissionsResolver: PermissionsResolverService,
    private readonly notifications: NotificationsService,
  ) {}

  async submitRegistrationRequest(dto: RegisterRequestDto) {
    const request = await this.prisma.registrationRequest.create({ data: dto });

    await this.notifications.notify({
      type: 'registration.new',
      title: 'Nouvelle demande d’inscription',
      body: `${dto.fullName} (${dto.phone}) demande à rejoindre JIMI PLAST.`,
      data: { requestId: request.id },
    });

    return { id: request.id, status: request.status };
  }

  async login(dto: LoginDto, meta: { userAgent?: string; ip?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { role: true },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Identifiants invalides');
    }

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) {
      await this.auditLog.record({
        entityType: 'User',
        entityId: user.id,
        action: 'LOGIN_FAILED',
      });
      throw new UnauthorizedException('Identifiants invalides');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException(
        user.status === 'PENDING'
          ? 'Compte en attente de validation'
          : 'Compte suspendu — contactez un administrateur',
      );
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.auditLog.record({ entityType: 'User', entityId: user.id, action: 'LOGIN' });

    return this.issueTokens(user.id, user.email, meta);
  }

  async refresh(rawToken: string, meta: { userAgent?: string; ip?: string }) {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expirée, reconnectez-vous');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
      throw new UnauthorizedException('Compte introuvable ou inactif');
    }

    return this.issueTokens(user.id, user.email, meta);
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async setAvatar(userId: string, avatarUrl: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl } });
    return { avatarUrl };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { role: true },
    });
    const { permissions } = await this.permissionsResolver.resolveForUser(userId);
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      locale: user.locale,
      role: { id: user.role.id, key: user.role.key, name: user.role.name },
      permissions,
    };
  }

  private async issueTokens(userId: string, email: string, meta: { userAgent?: string; ip?: string }) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { secret: this.config.getOrThrow('JWT_ACCESS_SECRET'), expiresIn: ACCESS_TOKEN_TTL },
    );

    const rawRefreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt,
        userAgent: meta.userAgent,
        ip: meta.ip,
      },
    });

    return { accessToken, refreshToken: rawRefreshToken, expiresIn: ACCESS_TOKEN_TTL };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}
