# SAL Builder · Golden Goose Weekly SAL

Versione online del tool locale `Golden_Goose_SAL_deck`. Next.js 15 su Vercel, database Neon (Postgres), file su Vercel Blob.

- **2 utenti**: `mc` (Marketing Cloud) e `sc` (Service Cloud + AMS). Ognuno modifica solo la propria area; il resto è in sola lettura.
- **Modifica con modali** (azioni, ticket, timeline) al posto degli accordion.
- **Timeline progetti** con lane SFMC / CROSS / SFSC.
- **Archivio**: stato Completed (o `(done)` nei ticket) = la voce passa in archivio, ripristinabile.
- **Export**: PDF (stampa del browser), PPTX (tabelle native), XLSX (archivio e ticket), JSON.
- **Import JSON**: deck del tool locale e export di questa app.
- **Import CSV Jira**: Ticket AMS → Importa CSV Jira (utente SC), export CSV con Issue key e Summary; unisce per codice senza cancellare i ticket esistenti. Stati Done/Closed/Resolved vanno in Archivio.
- **Settimane**: "Pubblica" salva una copia nello storico, "Nuova settimana" duplica righe attive e timeline.

## Messa online

### 1. GitHub
```bash
cd sal-builder
git init && git add . && git commit -m "SAL Builder"
git branch -M main
git remote add origin https://github.com/TUO_USER/sal-builder.git
git push -u origin main
```

### 2. Neon
1. neon.tech → New project (regione EU).
2. Connection Details → copia la stringa **pooled**: è la `DATABASE_URL`.

### 3. Vercel
1. Vercel → Add New → Project → importa il repo GitHub (framework Next.js, niente da cambiare).
2. Storage → Create → **Blob** → collegalo al progetto (crea `BLOB_READ_WRITE_TOKEN`).
3. Settings → Environment Variables (Production, Preview, Development):

| Variabile | Valore |
|---|---|
| `DATABASE_URL` | stringa Neon pooled |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `MC_PASSWORD` | password utente MC |
| `SC_PASSWORD` | password utente SC |
| `BLOB_READ_WRITE_TOKEN` | creato dallo store Blob |

4. Deploy.

### 4. Database e utenti (una volta, da locale)
```bash
npm i -g vercel && vercel link && vercel env pull .env.local   # oppure crea .env.local da .env.example
npm install
npm run db:migrate        # tabelle + utenti mc/sc + primo deck
```
`db:migrate` si può rilanciare: se cambi `MC_PASSWORD` / `SC_PASSWORD` aggiorna le password.

### Aggiornamento da una versione precedente
Se hai già fatto la migrazione: rilancia `npm run db:migrate` (aggiunge la colonna `activity`, non tocca i dati), poi fai push su GitHub. Per ricaricare i dati dal JSON usa `npm run db:import -- ./file.json --replace`.

### 5. Caricare il deck attuale (facoltativo)
Esporta il JSON dal tool locale (pulsante di export deck), poi:
```bash
npm run db:import -- ./Golden_Goose_SAL_deck_v3.json
```
Oppure da browser: Azioni → Importa JSON (ogni utente importa la propria area). Con `--replace` svuota prima.

### 6. Uso
Apri l'URL Vercel, accedi come MC o SC. Logo e sfondi: menu **Sfondi e loghi**.

## Sviluppo locale
```bash
cp .env.example .env.local   # compila
npm run dev
```

## Struttura
```
app/(app)/…        pagine: azioni, ticket, timeline, archivio, anteprima, impostazioni
app/print          pagina di stampa per il PDF
app/api/…          API (permessi per ruolo lato server)
lib/slides.ts      costruzione slide (max 12 righe, paginazione, archivio)
lib/pptx.ts        export PPTX (pptxgenjs)
lib/importer.ts    import JSON (tool locale + formato nativo)
db/schema.sql      schema Neon
```

## Note e limiti
- PPTX: font Montserrat e Outfit non incorporati; vanno installati sul PC, altrimenti PowerPoint li sostituisce. Impaginazione simile ma non identica al tool locale.
- Upload immagini: max 4 MB (limite del body su Vercel).
- Timeline: le barre si regolano per terzi di mese, senza trascinamento.
- Ticket AMS: una riga per ticket (nel tool locale erano un blocco unico con elenco).
- Il login non ha limite ai tentativi: usa password lunghe.

## Aggiornamento (restyle)
- Dopo aver scaricato questa versione esegui di nuovo `npm install` e `npm run db:migrate` (crea la tabella `settings` per il logo del login).
- Opzionale: `npm run db:import -- <file.json> --replace` per ricaricare i dati con il campo Activity Status.
- Tema chiaro/scuro: pulsante nella barra laterale e nel login. Logo login: *Sfondi e loghi*.
