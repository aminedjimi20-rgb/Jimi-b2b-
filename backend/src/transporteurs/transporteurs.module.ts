import { Module } from '@nestjs/common';
import { TransporteursController } from './transporteurs.controller';
import { TransporteursService } from './transporteurs.service';

@Module({
  controllers: [TransporteursController],
  providers: [TransporteursService],
})
export class TransporteursModule {}
