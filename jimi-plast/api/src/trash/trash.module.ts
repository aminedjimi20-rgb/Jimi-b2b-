import { Module } from '@nestjs/common';
import { TrashController } from './trash.controller';

@Module({
  controllers: [TrashController],
})
export class TrashModule {}
