import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CommonServicesModule } from '../common/services/common-services.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PassportModule, ConfigModule, CommonServicesModule, NotificationsModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
