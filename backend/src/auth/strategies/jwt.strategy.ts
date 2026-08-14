import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-user';

interface AccessTokenPayload {
  sub: string; // userId
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
    });
  }

  /**
   * Re-reads role/status/clientId from the DB on every request instead of
   * trusting the JWT payload for anything beyond the userId. This means a
   * suspended account or a role change takes effect immediately, without
   * waiting for the (short-lived) access token to expire.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { client: { select: { id: true } } },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Compte introuvable ou suspendu.');
    }

    return {
      userId: user.id,
      role: user.role,
      clientId: user.client?.id ?? null,
    };
  }
}
