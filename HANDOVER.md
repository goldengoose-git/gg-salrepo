# Handover – Weekly SAL Builder (Golden Goose) – 2026-11-03

**Stato**: produzione ferma a `13a6049` (`main`, tag `backup-pre-admin-all`). Branch `release/admin-all` su GitHub (ultimo push `ffc245f`); lo zip **v6** contiene tutto il lavoro successivo e va ancora copiato/pushato. Preview Vercel collegato al branch Neon `test-admin-all`.

## Cosa contiene la release
- **Admin All** (login nascosto `/accesso-riservato`, 8 ore, 5 tentativi/15 min), vede e scrive tutto.
- **Ticket AMS › Importa CSV Jira** (anteprima, aggiornamento per codice, backup JSON automatico).
- **Admin › Backup**: JSON, XLS, DB completo (.json.gz). `BACKUP_TOKEN` opzionale per lo script.
- **Admin › Colori ed Elenchi**: colori label (stati, AMS, timeline, OPEX/CAPEX) solo UI interna; Type MC/SC, Owner, Contract su tutte le settimane.
- **Admin › Normalizza date**: solo settimana corrente, annullabile (audit_log).
- **Sidebar**: sezione corrente evidenziata.
- **Slide**: max 12 righe, almeno 11 sulle slide piene, corpo 12,5 px (mai sotto 11), righe distribuite fino al footer ridotto (slide con ≥11 righe); sotto 11 righe altezza fissa 45 px; logo destro non più sulle slide tabella. PPTX con le stesse regole.
- **Presenta** (`/presenta`, `app/presenta/page.tsx`): presentazione a schermo intero, tutti gli utenti, F/G/B/Esc, cursore = punto rosso, `?s=N`, `?archive=0`.
- `scripts/weekly-check.mjs`: controllo coerenza settimanale.

## Flusso di test e rilascio
1. Da Fedora: copiare lo zip v6 in `~/gg-salrepo` (rsync escludendo `.env.local .DS_Store node_modules .next .git`), `git add -A`, commit, `git push` su `release/admin-all`.
2. Vercel: variabili `DATABASE_URL` e `SESSION_SECRET` solo Preview per il branch `release/admin-all`; Redeploy del Preview.
3. `db:migrate` sul DB di test con `.env.local` (`DATABASE_URL` test + `ADMIN_PASSWORD` alfanumerica: `#`, `$`, `!` rompono la lettura).
4. Test sul Preview: login admin, backup, import `Jira.csv` (366 righe: 357 Done, 6 On Hold, 2 New, 1 WIP), normalizza + annulla, colori solo UI, slide/PPTX.
5. Produzione: `db:migrate` sul DB prod, branch Neon di backup (auto-delete Never), merge su `main`, push, attendere Ready.

## Font PPTX
PPTX allineato all'anteprima/PDF (dimensioni px×0,75 pt), tutto in **Montserrat** (Regular, SemiBold, Bold, ExtraBold; stima righe con larghezza +14% rispetto a Outfit). Servono i 4 font installati dove si apre il PPTX: cartella `fonts/` (OFL) e `fonts/LEGGIMI.md`.

## Da fare
- (v7) Activity Status AMS in slide: OnGoing per tutti gli stati, Done solo se tutti completed.
- Test Preview con la v6 e verifica del PPTX in PowerPoint.
- **Ruotare la password `neondb_owner`** (esposta in chat/screenshot, vale anche per prod): aggiornare Vercel (Production e Preview), `.env.local`, Redeploy.
- Cambiare la password admin usata nei test (apparsa in chat) prima della produzione.
- Dopo i test: eliminare il branch Neon `test-admin-all` e le variabili Preview.
- Aggiornare il documento funzionale; eseguire `weekly-check.mjs` ogni settimana.

## Decisioni
Colori solo interfaccia interna; normalizzazione solo settimana corrente; backup Neon manuale a cura di Stefano; Completed resta nella week corrente.

Dettagli tecnici e regole dati: `HANDOVER.json`, `DEPLOY.md`.

## v11 (2026-11-04)
- Presenta: Completed Activities escluse di default (`?archive=1` per includerle).
- Campo Rilascio tolto da modale, tabella, slide/PPTX (colonna DB e import/export CSV restano).
- Righe completate: badge viola "✓ Done" in Activity Status (anteprima, PDF, PPTX).
- AMS: impaginazione per altezza (una slide finché entrano, poi pagine bilanciate, mai 1-2 ticket orfani); toast Done corretto.

## v12 (2026-11-04)
- **Pubblica settimana** genera il PPTX (con Completed) e lo carica su SharePoint via flusso Power Automate (`SAL_EXPORT_URL`, vedi `POWER_AUTOMATE.md`). Se l'upload fallisce la settimana non viene pubblicata. Esito in `decks.export_*` (migrazione idempotente: `npm run db:migrate`).
- **Nuova settimana** richiede export riuscito (409 altrimenti; solo ADMIN puo forzare con `force:true` via API). Admin: pulsante "Riesporta" in Anteprima (`POST /api/deck/export`).
- **Completed Activities** (anteprima, PDF, PPTX, Presenta): solo voci archiviate con `closed_at` negli ultimi 14 gg (MC) / 7 gg (SC, AMS) dalla data SAL; le Completed della settimana corrente restano nelle tabelle. Presenta le include di default (`?archive=0` le esclude); toggle export acceso di default.
- Import Jira: `closed_at` da *Resolved* (fallback *Updated*).
- v12b: banda in alto con ambiente (Produzione/Preview/Locale), branch git e commit (variabili Vercel), endpoint DB Neon (solo Admin; etichetta facoltativa `SAL_DB_LABEL`), utente e orario di login (`iat` del JWT).
- v12c: ID del blocco AMS centrato verticalmente (anteprima e PPTX); Archivio › "PDF completati 14 gg" (`/print/completati?days=14`, `GET /api/completed`): voci completate negli ultimi N giorni da tutte le settimane, raggruppate MC/SC/AMS.
