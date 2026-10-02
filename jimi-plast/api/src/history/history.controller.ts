import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { AuditLogService } from '../common/services/audit-log.service';
import { RequirePermissions } from '../common/decorators/permissions.decorator';

/** Vue globale du journal d'audit déjà tenu par tous les autres modules
 * (AuditLogService.record) — jusqu'ici uniquement consulté par entité, jamais
 * en vue d'ensemble. */
@Controller('history')
@RequirePermissions('audit.view')
export class HistoryController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  list(@Query('q') q: string | undefined, @Query('includeHidden') includeHidden: string | undefined) {
    return this.auditLog.list({ q, includeHidden: includeHidden === 'true' });
  }

  @Put(':id/hide')
  setHidden(@Param('id') id: string, @Body('hidden') hidden: boolean | undefined) {
    return this.auditLog.setHidden(id, hidden ?? true);
  }
}
