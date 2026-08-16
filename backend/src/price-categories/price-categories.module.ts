import { Module } from '@nestjs/common';
import { PriceCategoriesController } from './price-categories.controller';
import { PriceCategoriesService } from './price-categories.service';

@Module({
  controllers: [PriceCategoriesController],
  providers: [PriceCategoriesService],
})
export class PriceCategoriesModule {}
