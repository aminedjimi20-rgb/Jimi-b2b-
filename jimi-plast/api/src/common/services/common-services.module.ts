import { Global, Module } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { TrashService } from './trash.service';
import { NumberSequenceService } from './number-sequence.service';
import { PermissionsResolverService } from './permissions-resolver.service';

/** Services transversaux utilisés par tous les modules métier. */
@Global()
@Module({
  providers: [AuditLogService, TrashService, NumberSequenceService, PermissionsResolverService],
  exports: [AuditLogService, TrashService, NumberSequenceService, PermissionsResolverService],
})
export class CommonServicesModule {}
