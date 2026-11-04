# Export PPTX su SharePoint via Power Automate (v12)

## Flusso (cloud flow, trigger HTTP)
1. **Trigger**: "Quando viene ricevuta una richiesta HTTP" (richiede licenza Power Automate con connettore premium). Schema JSON del corpo:
   `{ "fileName": "", "folderPath": "", "week": "", "salDate": "", "contentBase64": "" }`
2. **Condizione** (consigliata): intestazione `x-sal-secret` uguale al segreto scelto. Altrimenti Risposta 401 e fine.
3. **Crea file** (SharePoint)
   - Indirizzo sito: `https://pwceur.sharepoint.com/sites/IT-ADV-Salesforce_ITA_Practice`
   - Percorso cartella: `/Shared Documents/` + `triggerBody()?['folderPath']`
     (di default `Golden Goose/1 - PM/SAL/SAL CRM-Marketing 2026`, l'anno e calcolato dal deck)
   - Nome file: `triggerBody()?['fileName']`
   - Contenuto file: `base64ToBinary(triggerBody()?['contentBase64'])`
4. **Risposta** (OBBLIGATORIA, dopo Crea file): codice 200, corpo `{ "ok": true, "webUrl": "@{outputs('Crea_file')?['body/{Link}']}" }`.
   Configura "Esegui dopo" -> *ha esito negativo* su una seconda Risposta 500 con il messaggio di errore: cosi l'app vede l'errore e blocca la pubblicazione.
   Senza azione Risposta il flusso risponde 202 subito e l'app rifiuta l'export.

## Variabili d'ambiente (Vercel, mai in chat/commit)
- `SAL_EXPORT_URL`: URL del trigger (contiene la firma `sig=`)
- `SAL_EXPORT_SECRET`: segreto condiviso (facoltativo, inviato come `x-sal-secret`)
- `SAL_EXPORT_FOLDER`: facoltativa, default `Golden Goose/1 - PM/SAL/SAL CRM-Marketing {year}`
Senza `SAL_EXPORT_URL` l'export e disattivato e "Nuova settimana" non e vincolata (es. Preview).
