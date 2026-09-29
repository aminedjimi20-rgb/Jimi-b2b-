import { Module } from '@nestjs/common';
import { FactoryResetController } from './factory-reset.controller';
import { FactoryResetService } from './factory-reset.service';

@Module({
  controllers: [FactoryResetController],
  providers: [FactoryResetService],
})
export class AdminModule {}
