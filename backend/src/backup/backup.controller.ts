import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { BackupService, createReadStream } from './backup.service';

@Roles('ADMIN')
@Controller('backup')
export class BackupController {
  constructor(private backupService: BackupService) {}

  @Get()
  list() {
    return this.backupService.list();
  }

  @Post('run')
  run() {
    return this.backupService.runBackup();
  }

  @Get(':filename')
  async download(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.backupService.filePath(filename);
    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    createReadStream(filePath).pipe(res);
  }
}
