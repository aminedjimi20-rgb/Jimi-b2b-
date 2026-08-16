import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { randomBytes } from 'crypto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { resetPasswordFormPage, verifyErrorPage, verifySuccessPage } from './auth-pages.util';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Tighter than the global 100/min: login is the one endpoint worth
  // protecting against credential brute-forcing specifically.
  @Public()
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Opened directly from the verification email in a browser — renders a
  // small HTML page instead of JSON since there's no app/JS client here.
  @Public()
  @Get('verify-email')
  async verifyEmailPage(@Query('token') token: string | undefined, @Res() res: Response) {
    try {
      if (!token) throw new BadRequestException('Lien invalide.');
      await this.authService.verifyEmailByToken(token);
      res.type('html').send(verifySuccessPage());
    } catch (e) {
      res.type('html').send(verifyErrorPage(e instanceof Error ? e.message : 'Lien invalide ou expiré.'));
    }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('resend-verification')
  resendVerification(@Body() dto: ForgotPasswordDto) {
    return this.authService.resendVerification(dto.email);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // GET renders the "choose a new password" form (opened from the reset
  // email); the form itself POSTs back to this same path as JSON. The page
  // needs an inline <script> for the eye-toggle/submit handling — instead of
  // weakening helmet's global CSP for the whole API, this one response gets
  // a scoped nonce-based script-src exception, nothing else changes.
  @Public()
  @Get('reset-password')
  resetPasswordPage(@Query('token') token: string | undefined, @Res() res: Response) {
    if (!token) {
      res.type('html').send(verifyErrorPage('Lien invalide.'));
      return;
    }
    const nonce = randomBytes(16).toString('base64');
    res.setHeader(
      'Content-Security-Policy',
      `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'nonce-${nonce}'; script-src-attr 'none'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'`,
    );
    res.type('html').send(resetPasswordFormPage(token, nonce));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPasswordByToken(dto);
    return { message: 'Mot de passe réinitialisé.' };
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('change-password')
  async changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    await this.authService.changePassword(user.userId, dto.currentPassword, dto.newPassword);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RefreshTokenDto) {
    await this.authService.logout(user.userId, dto.refreshToken);
  }
}
