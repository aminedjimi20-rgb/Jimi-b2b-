import { Body, Controller, Post } from '@nestjs/common';
import { FactoryResetService } from './factory-reset.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { FactoryResetDto } from './dto/factory-reset.dto';

@Controller('admin')
export class FactoryResetController {
  constructor(private readonly service: FactoryResetService) {}

  // Le contrôle réel (rôle admin) est refait dans le service — cette garde
  // n'est qu'une première barrière, jamais la seule.
  @Post('factory-reset')
  @RequirePermissions('users.manage')
  reset(@Body() dto: FactoryResetDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.reset(user.id, dto.confirm);
  }
}
