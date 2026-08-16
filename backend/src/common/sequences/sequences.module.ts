import { Global, Module } from '@nestjs/common';
import { SequencesService } from './sequences.service';

// @Global() — every module that needs a human-readable reference number
// (orders, receipts, future transport bons, ...) can inject this without
// each one importing SequencesModule individually.
@Global()
@Module({
  providers: [SequencesService],
  exports: [SequencesService],
})
export class SequencesModule {}
