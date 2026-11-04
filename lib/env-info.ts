// Informazioni sull'ambiente in cui gira l'app (solo lato server): mostrate nella banda in alto.
export type EnvInfo = { env: string; gitBranch: string; commit: string; dbEndpoint: string; dbLabel: string };
export function getEnvInfo(): EnvInfo {
  let dbEndpoint = '?';
  try {
    const host = new URL(process.env.DATABASE_URL ?? '').host; // ep-xxx-yyy-123456[-pooler].regione.aws.neon.tech
    dbEndpoint = host.split('.')[0].replace(/-pooler$/, '');
  } catch {}
  return {
    env: process.env.VERCEL_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'local'),
    gitBranch: process.env.VERCEL_GIT_COMMIT_REF ?? '',
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7),
    dbEndpoint,
    dbLabel: process.env.SAL_DB_LABEL ?? '', // facoltativa: es. TEST oppure PRODUZIONE
  };
}
