import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';
import { q } from '@/lib/db';
import { audit, isErr, needAdminOrToken } from '@/lib/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const qi = (s: string) => '"' + s.replace(/"/g, '""') + '"';

// Backup DB completo lato server: TUTTE le tabelle dello schema public (utenti con hash, audit_log, login_attempts inclusi),
// in streaming e compresso (.json.gz). Solo Admin All (o Bearer BACKUP_TOKEN per lo script settimanale).
export async function GET(req: Request) {
  const me = await needAdminOrToken(req);
  if (isErr(me)) return me;
  const tables = await q<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name");
  await audit(me, 'backup-db', 'db', null, { tables: tables.map((t) => t.table_name) });

  async function* gen() {
    const counts: Record<string, number> = {};
    yield `{"format":"sal-builder-db-dump","version":1,"exported_at":${JSON.stringify(new Date().toISOString())},"tables":{`;
    let first = true;
    for (const t of tables) {
      const rows = await q<any>(`select * from ${qi(t.table_name)}`);
      counts[t.table_name] = rows.length;
      yield `${first ? '' : ','}${JSON.stringify(t.table_name)}:${JSON.stringify(rows)}`;
      first = false;
    }
    yield `},"counts":${JSON.stringify(counts)}}`;
  }
  const gz = Readable.from(gen()).pipe(createGzip());
  const day = new Date().toISOString().slice(0, 10);
  return new Response(Readable.toWeb(gz) as unknown as ReadableStream, {
    headers: { 'content-type': 'application/gzip', 'content-disposition': `attachment; filename="SAL_DB_completo_${day}.json.gz"`, 'cache-control': 'no-store' },
  });
}
