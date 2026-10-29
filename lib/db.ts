import { neon } from '@neondatabase/serverless';

let _sql: ReturnType<typeof neon> | null = null;
export function db() {
  if (!_sql) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL mancante');
    _sql = neon(process.env.DATABASE_URL);
  }
  return _sql;
}
// esegue una query parametrica e restituisce le righe
export async function q<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const rows = await db().query(text, params);
  return rows as unknown as T[];
}
