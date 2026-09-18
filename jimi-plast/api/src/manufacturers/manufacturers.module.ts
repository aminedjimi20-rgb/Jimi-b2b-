import { Module } from '@nestjs/common';
import { ManufacturersService } from './manufacturers.service';
import { ManufacturersController } from './manufacturers.controller';
import { PendingDeletionsModule } from '../pending-deletions/pending-deletions.module';

@Module({
  imports: [PendingDeletionsModule],
  controllers: [ManufacturersController],
  providers: [ManufacturersService],
  exports: [ManufacturersService],
})
export class ManufacturersModule {}
