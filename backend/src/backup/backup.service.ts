import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { spawn } from 'child_process';
import { createReadStream, createWriteStream } from 'fs';
import { mkdir, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';

const RETENTION_COUNT = 30; // keep the last 30 daily backups on disk

/**
 * Scheduled + on-demand PostgreSQL backups via `pg_dump`, gzip-compressed
 * to a local directory (BACKUP_DIR, defaults to ./backups). This is the
 * "Backup" half of docs/ARCHITECTURE.md §10 — restore is intentionally
 * NOT exposed as an API endpoint (a destructive action never belongs
 * behind a mobile app tap); see scripts/restore.sh for the admin CLI
 * restore procedure documented in DEPLOYMENT.md.
 *
 * BACKUP_DIR is local disk by default so this works out of the box in
 * any environment; point it at a mounted volume backed by object storage
 * (S3/R2) in production for real offsite durability.
 */
@Injectable()
export class BackupService {
  private readonly logger = new Logger(BackupService.name);

  constructor(private config: ConfigService) {}

  private get backupDir(): string {
    return this.config.get<string>('BACKUP_DIR') ?? join(process.cwd(), 'backups');
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledBackup() {
    try {
      await this.runBackup();
    } catch (error) {
      this.logger.error(`Sauvegarde planifiée échouée: ${(error as Error).message}`);
    }
  }

  async runBackup(): Promise<{ filename: string; sizeBytes: number }> {
    const databaseUrl = this.pgDumpConnectionString(this.config.getOrThrow<string>('DATABASE_URL'));
    await mkdir(this.backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `jimi-b2b-${timestamp}.sql.gz`;
    const filePath = join(this.backupDir, filename);

    // pg_dump writes the SQL dump to stdout; we gzip-pipe it straight to disk
    // so we never hold the whole dump in memory regardless of DB size.
    const dump = spawn('pg_dump', [databaseUrl, '--no-owner', '--no-privileges']);
    const gzip = createGzip();
    const out = createWriteStream(filePath);

    let stderr = '';
    dump.stderr.on('data', (chunk) => (stderr += chunk.toString()));

    // Registered before the `await` below on purpose: for a small/fast dump,
    // pg_dump can exit (and emit 'close') before `pipeline()` resolves, and a
    // listener attached only after that await would miss the event and hang
    // forever — this promise is created synchronously so it can't miss it.
    const exitPromise = new Promise<number>((resolve) => dump.on('close', (code) => resolve(code ?? 1)));

    await pipeline(dump.stdout, gzip, out);
    const exitCode = await exitPromise;
    if (exitCode !== 0) {
      await unlink(filePath).catch(() => undefined);
      throw new Error(`pg_dump a échoué (code ${exitCode}): ${stderr}`);
    }

    this.logger.log(`Sauvegarde créée: ${filename}`);
    await this.enforceRetention();

    const { size } = await stat(filePath);
    return { filename, sizeBytes: size };
  }

  async list() {
    await mkdir(this.backupDir, { recursive: true });
    const files = await readdir(this.backupDir);
    const withStats = await Promise.all(
      files
        .filter((f) => f.endsWith('.sql.gz'))
        .map(async (filename) => {
          const s = await stat(join(this.backupDir, filename));
          return { filename, sizeBytes: s.size, createdAt: s.birthtime };
        }),
    );
    return withStats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  filePath(filename: string): string {
    // Reject path traversal — filename must be a plain backup file basename.
    if (!/^[\w.-]+\.sql\.gz$/.test(filename)) throw new Error('Nom de fichier de sauvegarde invalide.');
    return join(this.backupDir, filename);
  }

  /**
   * `DATABASE_URL` is a Prisma connection string and may carry
   * Prisma-only query params (`schema`, `connection_limit`, `pgbouncer`,
   * ...) that `pg_dump` rejects outright. Prisma's own `schema` param
   * just selects the default search_path, which `pg_dump` already covers
   * (it dumps every schema unless restricted with -n), so it's safe to
   * drop entirely rather than translate.
   */
  private pgDumpConnectionString(databaseUrl: string): string {
    const url = new URL(databaseUrl);
    url.search = '';
    return url.toString();
  }

  private async enforceRetention() {
    const backups = await this.list();
    const toDelete = backups.slice(RETENTION_COUNT);
    await Promise.all(toDelete.map((b) => unlink(join(this.backupDir, b.filename))));
  }
}

// Re-exported so the controller can stream a backup file without importing `fs` itself.
export { createReadStream };
