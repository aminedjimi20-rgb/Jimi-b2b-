import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailerService } from '../mailer/mailer.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private mailer: MailerService,
  ) {}

  async login(dto: LoginDto): Promise<TokenPair & { role: string }> {
    if (!dto.email && !dto.phone) {
      throw new UnauthorizedException('Email ou téléphone requis.');
    }

    const user = await this.prisma.user.findFirst({
      where: dto.email ? { email: dto.email } : { phone: dto.phone },
    });

    if (!user) throw new UnauthorizedException('Identifiants invalides.');

    const passwordOk = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordOk) throw new UnauthorizedException('Identifiants invalides.');

    if (user.status === 'PENDING') {
      throw new UnauthorizedException('Veuillez vérifier votre email avant de vous connecter (lien envoyé à l\'inscription).');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Ce compte est suspendu ou inactif.');
    }

    const tokens = await this.issueTokens(user.id);
    return { ...tokens, role: user.role };
  }

  /**
   * Public self-registration — always a CLIENT account, tied to the email
   * (never the phone, so the same account can be opened from several
   * devices). Starts PENDING/unverified; the Admin can assign a price
   * category/credit terms afterwards exactly like an Admin-provisioned
   * client, verification just unblocks the login itself.
   */
  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Cet email est déjà utilisé.');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const rawToken = randomBytes(32).toString('hex');

    await this.prisma.client.create({
      data: {
        raisonSociale: dto.raisonSociale,
        telephone: dto.telephone,
        adresse: dto.adresse,
        ville: dto.ville,
        user: {
          create: {
            email: dto.email,
            passwordHash,
            role: 'CLIENT',
            status: 'PENDING',
            emailVerified: false,
            emailVerificationTokenHash: this.hashToken(rawToken),
            emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
          },
        },
      },
    });

    await this.sendVerificationEmail(dto.email, rawToken);
    return { message: 'Compte créé. Vérifiez votre boîte mail pour activer votre compte.' };
  }

  /** Re-sends a fresh verification link — silently no-ops for an unknown/already-verified email (no account enumeration). */
  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && !user.emailVerified) {
      const rawToken = randomBytes(32).toString('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          emailVerificationTokenHash: this.hashToken(rawToken),
          emailVerificationExpiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
        },
      });
      await this.sendVerificationEmail(email, rawToken);
    }
    return { message: 'Si ce compte existe et n\'est pas encore vérifié, un nouveau lien a été envoyé.' };
  }

  /** Called from the (public, HTML) verify-email link — activates the account. */
  async verifyEmailByToken(rawToken: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { emailVerificationTokenHash: this.hashToken(rawToken) } });
    if (!user || !user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Lien de vérification invalide ou expiré.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        status: 'ACTIVE',
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
  }

  /** Always returns the same generic message regardless of whether the email exists — avoids account enumeration. */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) {
      const rawToken = randomBytes(32).toString('hex');
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: this.hashToken(rawToken),
          passwordResetExpiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
        },
      });
      const link = `${this.publicApiUrl()}/auth/reset-password?token=${rawToken}`;
      await this.mailer.send(
        email,
        'Réinitialisation de votre mot de passe — JIMI B2B',
        `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1h) :\n${link}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
      );
    }
    return { message: 'Si un compte existe avec cet email, un lien de réinitialisation a été envoyé.' };
  }

  /** Called from the (public, HTML) reset-password form. Revokes existing sessions — a leaked old session can't survive a reset. */
  async resetPasswordByToken(dto: ResetPasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { passwordResetTokenHash: this.hashToken(dto.token) } });
    if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt < new Date()) {
      throw new BadRequestException('Lien de réinitialisation invalide ou expiré.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordResetTokenHash: null, passwordResetExpiresAt: null },
      }),
      this.prisma.refreshToken.updateMany({ where: { userId: user.id, revoked: false }, data: { revoked: true } }),
    ]);
  }

  /** Authenticated self-service password change (Admin/Employee/Client alike). */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Compte introuvable.');

    const currentOk = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!currentOk) throw new BadRequestException('Mot de passe actuel incorrect.');

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  private async sendVerificationEmail(email: string, rawToken: string): Promise<void> {
    const link = `${this.publicApiUrl()}/auth/verify-email?token=${rawToken}`;
    await this.mailer.send(
      email,
      'Vérifiez votre email — JIMI B2B',
      `Bienvenue sur JIMI B2B ! Cliquez sur ce lien pour activer votre compte (valable 24h) :\n${link}`,
    );
  }

  private publicApiUrl(): string {
    return (this.config.get<string>('PUBLIC_API_URL') ?? 'http://localhost:3000/api').replace(/\/$/, '');
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token invalide.');
    }

    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { userId: payload.sub, tokenHash, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré.');
    }

    // Rotation: revoke the used token, issue a brand new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revoked: true },
    });

    return this.issueTokens(payload.sub);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { userId, tokenHash },
      data: { revoked: true },
    });
  }

  private async issueTokens(userId: string): Promise<TokenPair> {
    const accessToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m',
      },
    );

    const refreshExpiresIn = this.config.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '30d';
    const refreshToken = this.jwt.sign(
      { sub: userId },
      {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt: new Date(Date.now() + this.parseDurationMs(refreshExpiresIn)),
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string): string {
    // Refresh tokens are stored as a SHA-256 hash, never in cleartext —
    // a DB leak alone can't be replayed as a valid refresh token.
    return createHash('sha256').update(token).digest('hex');
  }

  private parseDurationMs(duration: string): number {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match) return 30 * 24 * 60 * 60 * 1000;
    const value = Number(match[1]);
    const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as 's' | 'm' | 'h' | 'd'];
    return value * unitMs;
  }
}
