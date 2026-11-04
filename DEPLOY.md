# Deploy – Weekly SAL Builder (release Admin All)

Questa release contiene anche la regola "Completed resta nella week" già pronta nello zip precedente ma non ancora su GitHub (produzione ferma al commit 13a6049).

## Novità
- **Admin All**: utente con login nascosto (`/accesso-riservato`, nessun link dall'app), vede e scrive tutto (MC, SC, AMS, timeline, elenchi). Sessione 8 ore, limite 5 tentativi falliti ogni 15 minuti.
- **Ticket AMS › Importa CSV Jira**: anteprima, mappatura Jira, aggiornamento per codice, Done nuovi in Archivio (opzionale), backup JSON automatico prima dell'import. Visibile a SC e Admin All.
- **Admin › Backup e ripristino**: Scarica JSON, Scarica XLS (tutte le settimane), Esegui backup DB (tutte le tabelle, .json.gz, in streaming).
- **Admin › Colori ed Elenchi**: colori label (stati, AMS, timeline, **OPEX/CAPEX**) **solo interfaccia interna** (slide, PPTX e PDF invariati); modifica Type MC, Type SC, Owner, Contract con rinomina/unione su **tutte le settimane**.
- **Admin › Normalizza date**: solo **settimana corrente**; Sept→Sep, June→Jun, Beginning→Beg…; regole personalizzate, anteprima, annulla ultima normalizzazione.
- **Barra laterale**: la sezione corrente è evidenziata (sfondo, barra rossa a sinistra, grassetto, `aria-current`).
- **Slide**: massimo 12 righe per slide, almeno 11 sulle slide piene. Corpo 12,5 px (scende a 11,5 o 11 px solo se le voci sono lunghe, mai sotto 11), righe distribuite fino a poco sopra il footer (ridotto) sulle slide piene (11-12 righe); le slide con meno righe mantengono la stessa altezza riga, senza ingrandire. Il logo destro non compare più sulle slide tabella. Vale per anteprima, PDF e PPTX (corpo 9,25-8,25 pt).
- **scripts/weekly-check.mjs**: scarica i backup e verifica la coerenza (vedi sotto).

## Prima di iniziare
1. Branch Neon di backup con auto-delete **Never** (come da handover).
2. Dall'app attuale: Azioni › Backup completo (file JSON) e conservalo.

## Passi
1. Scompatta lo zip e copia nel repo (come sempre):
   ```
   rsync -a --exclude .env.local --exclude .DS_Store --exclude node_modules --exclude .next --exclude .git sal-builder/ gg-salrepo/
   ```
2. In `gg-salrepo/.env.local` (solo locale, mai su git) aggiungi:
   ```
   ADMIN_PASSWORD=<almeno 16 caratteri, generata da te, mai in chat>
   ```
   Facoltativo, per lo script automatico: `BACKUP_TOKEN=<24+ caratteri casuali>` anche in Vercel › Settings › Environment Variables (Production), poi Redeploy. Senza token il download automatico è disattivato.
3. **Migrazione PRIMA del deploy** (lo schema cambia: il ruolo ADMIN è ammesso nella tabella users e c'è un nuovo indice):
   ```
   cd gg-salrepo && npm ci && npm run db:migrate
   ```
   Deve stampare `Schema OK` e `Utente admin (ADMIN) OK`. La migrazione è idempotente e retrocompatibile: il codice attuale in produzione continua a funzionare.
4. `git status` (`.env.local` non deve comparire), poi:
   ```
   git add -A
   git commit -m "Admin All, import CSV Jira, backup, colori UI, normalizza date, slide >=10 righe"
   git push origin main
   ```
   Se il push dà 503/P3P: hotspot o VPN spenta. Se dice "Everything up-to-date" dopo un errore: controlla `git log origin/main` e Vercel.
5. Su Vercel › Deployments attendi **Ready** sul commit nuovo, poi ricarica l'app (Cmd+Shift+R).

## Verifiche dopo il deploy (10 minuti)
- Login MC e SC come prima. Sulla barra laterale la voce della pagina aperta è evidenziata.
- Apri `/accesso-riservato`, entra con la password Admin All: compare il blocco **Admin All** nella barra laterale.
- Admin › Backup: scarica JSON, XLS e backup DB; apri l'XLS e controlla i fogli.
- Ticket AMS › Importa CSV Jira: carica `Jira.csv`, controlla l'anteprima (366 righe: 357 Done, 6 On Hold, 2 New, 1 WIP) e importa solo dopo il backup.
- Admin › Normalizza date: controlla l'anteprima (Beg Sept → Beg Sep), applica, verifica in tabella; prova «Annulla ultima normalizzazione».
- Admin › Colori: cambia un colore, verifica tabelle e timeline; poi Anteprima/PPTX/PDF devono avere i colori originali.
- Anteprima: le tabelle MC/SC con molte righe devono avere ≥10 righe per slide; controlla a occhio il PPTX (le slide compatte hanno font 7,5 pt).

## Controllo settimanale
Ogni settimana (per es. prima di «Nuova settimana»):
```
# automatico (serve BACKUP_TOKEN su Vercel e in locale)
SAL_URL=https://<tuo-progetto>.vercel.app BACKUP_TOKEN=<token> node scripts/weekly-check.mjs

# oppure su file scaricati a mano da Admin › Backup e ripristino
node scripts/weekly-check.mjs --file SAL_backup_completo_AAAA-MM-GG.json --db SAL_DB_completo_AAAA-MM-GG.json.gz
```
Salva i file e `report.md` in `backups/AAAA-MM-GG/` (cartella ignorata da git). Verifica: conteggi dichiarati, id duplicati, voci senza settimana, stati e archivio coerenti con la regola Completed, ticket AMS (stato Jira/status, duplicati), barre timeline, elenchi, label data non normalizzate, impostazioni, hash password, tentativi di login falliti, e confronto con il controllo precedente (voci sparite, settimane in meno). Esce con codice 1 se trova errori.

## Rollback
`git revert <commit>` e push. Lo schema resta compatibile (l'utente admin non viene usato dal codice precedente). Per ripristinare dati: Azioni › Ripristina da backup, oppure il branch Neon di backup.

## Note
- Login admin: il blocco scatta dopo 5 tentativi falliti in 15 minuti da qualsiasi IP. Per sbloccare, svuota `login_attempts` da Neon. Il captcha Turnstile non è attivo su `/accesso-riservato`.
- Il backup DB contiene gli hash delle password: conservalo come un segreto.
- Il token `BACKUP_TOKEN` abilita solo il download dei due backup in sola lettura; per revocarlo togli la variabile e fai Redeploy.

## Font del PPTX
Il PPTX usa solo Montserrat, richiamato per nome: installa i 4 file Montserrat della cartella `fonts/` (vedi `fonts/LEGGIMI.md`) sul computer che apre il PPTX, altrimenti PowerPoint li sostituisce. Il PDF non ha questo problema.
