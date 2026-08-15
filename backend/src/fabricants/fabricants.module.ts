import { Module } from '@nestjs/common';
import { FabricantsController } from './fabricants.controller';
import { FabricantsService } from './fabricants.service';

@Module({
  controllers: [FabricantsController],
  providers: [FabricantsService],
})
export class FabricantsModule {}
