import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { FavoritesService } from './favorites.service';

@Roles('CLIENT')
@Controller('favorites')
export class FavoritesController {
  constructor(private favoritesService: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.favoritesService.list(user.clientId!);
  }

  @Post(':productId')
  add(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.favoritesService.add(user.clientId!, productId);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('productId') productId: string) {
    return this.favoritesService.remove(user.clientId!, productId);
  }
}
