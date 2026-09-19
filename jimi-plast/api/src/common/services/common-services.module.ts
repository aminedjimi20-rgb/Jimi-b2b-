import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { TrashService } from './trash.service';
import { NumberSequenceService } from './number-sequence.service';
import { PermissionsResolverService } from './permissions-resolver.service';
import { StatementPdfService } from './statement-pdf.service';

/** Services transversaux utilisés par tous les modules métier. */
@Global()
@Module({
  providers: [AuditLogService, TrashService, NumberSequenceService, PermissionsResolverService, StatementPdfService],
  exports: [AuditLogService, TrashService, NumberSequenceService, PermissionsResolverService, StatementPdfService],
})
export class CommonServicesModule {}
