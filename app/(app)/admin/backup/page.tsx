'use client';
import { useState } from 'react';
import { useApp } from '@/components/AppShell';
import RestoreModal from '@/components/RestoreModal';
import { Ic } from '@/components/icons';
import { download } from '@/lib/client';

type K = 'json' | 'xls' | 'db';

export default function AdminBackup() {
  const { toast } = useApp();
  const [busy, setBusy] = useState<K | ''>('');
  const [rest, setRest] = useState(false);
  async function run(k: K, path: string, fallback: string) {
    setBusy(k);
    try { await download(path, fallback); toast('Download avviato'); } catch (e: any) { toast(e.message); }
    setBusy('');
  }
  const day = new Date().toISOString().slice(0, 10);
  return (
    <>
      <div className="top"><h2>Backup e ripristino</h2><span className="muted">Solo Admin All · ogni download è registrato nell&apos;audit log</span></div>
      <div className="body" style={{ display: 'grid', gap: 20, maxWidth: 1000 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 18 }}>
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="lab">Backup JSON</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>File di backup dell&apos;app, ripristinabile da «Ripristina da backup». Tutte le settimane, voci archiviate incluse, timeline, snapshot, elenchi, impostazioni, stato editing. Esclusi utenti, password e immagini.</div>
            <span className="sp" />
            <button className="btn pri" disabled={!!busy} onClick={() => run('json', '/api/export/backup', `SAL_backup_completo_${day}.json`)}><Ic n="dl" />{busy === 'json' ? 'Preparo…' : 'Scarica JSON'}</button>
          </div>
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="lab">Export Excel</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Cartella di lavoro leggibile: fogli Azioni MC, Azioni SC, Ticket AMS, Archivio, Timeline, Settimane, Elenchi, Impostazioni. Tutte le settimane, con filtri.</div>
            <span className="sp" />
            <button className="btn pri" disabled={!!busy} onClick={() => run('xls', '/api/admin/export-xlsx', `SAL_export_completo_${day}.xlsx`)}><Ic n="dl" />{busy === 'xls' ? 'Preparo…' : 'Scarica XLS'}</button>
          </div>
          <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10, border: '2px solid var(--fgb)' }}>
            <div className="lab">Backup DB completo · backend</div>
            <div className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Copia lato server di tutte le tabelle del database (utenti con hash, audit_log e login_attempts inclusi), compressa in .json.gz. Da conservare in un luogo sicuro: contiene gli hash delle password.</div>
            <span className="sp" />
            <button className="btn pri" disabled={!!busy} onClick={() => run('db', '/api/admin/backup-db', `SAL_DB_completo_${day}.json.gz`)}><Ic n="dl" />{busy === 'db' ? 'Preparo…' : 'Esegui backup DB'}</button>
          </div>
        </div>
        <div className="card" style={{ padding: 20 }}>
          <div className="lab" style={{ marginBottom: 8 }}>Ripristino e verifica</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn" onClick={() => setRest(true)}><Ic n="undo" />Ripristina da backup JSON…</button>
            <span className="muted" style={{ fontSize: 13 }}>Il ripristino è additivo (o con sovrascrittura) e non cancella mai righe. Per il controllo di coerenza settimanale usa <code>scripts/weekly-check.mjs</code> (vedi DEPLOY.md).</span>
          </div>
        </div>
      </div>
      {rest && <RestoreModal onClose={() => setRest(false)} />}
    </>
  );
}
