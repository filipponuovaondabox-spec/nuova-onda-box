# Nuova Onda Box

Gestionale dello scatolificio **Nuova Onda Box**: clienti, articoli, entrate di
magazzino, produzione, spedizioni, segnalazioni "Da ordinare" e gestione utenti —
sincronizzati in tempo reale su tutti i dispositivi (ufficio, telefono, operatori).

- **Frontend**: Next.js (static export) → Cloudflare Pages
- **Backend**: Cloudflare Pages Functions (`functions/`) → API `GET/PUT /api/db`
- **Database**: Cloudflare D1 (SQLite serverless), binding `DB`

Le tabelle D1 vengono create automaticamente alla prima richiesta e viene seedato
l'utente admin predefinito: **username `admin` · password `nuovaonda2024`**
(modificabile dalla sezione "Utenti" dell'app).

---

## Deploy su Cloudflare (via GitHub)

### 1. Pubblica il codice su GitHub

```bash
git init
git add .
git commit -m "Nuova Onda Box"
git remote add origin https://github.com/<tuo-utente>/nuova-onda-box.git
git push -u origin main
```

### 2. Crea il database D1

```bash
npx wrangler login
npx wrangler d1 create nuova-onda-db
```

Il comando stampa un `database_id`: copialo in `wrangler.toml` al posto di
`INSERISCI_QUI_IL_TUO_DATABASE_ID`, poi fai commit e push della modifica.

### 3. Collega il repository a Cloudflare Pages

1. Vai su [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Seleziona il repository `nuova-onda-box`.
3. Impostazioni di build:
   - **Framework preset**: `Next.js (Static HTML Export)`
   - **Build command**: `npm run pages:build`
   - **Build output directory**: `out`
4. Clicca **Save and Deploy**.

### 4. Collega il database D1 al progetto Pages

1. Apri il progetto Pages → **Settings** → **Functions** → **D1 database bindings**.
2. Aggiungi un binding:
   - **Variable name**: `DB`
   - **D1 database**: `nuova-onda-db`
3. Fai un nuovo deploy (o **Retry deployment**) per attivare il binding.

Fatto: l'app è online all'URL `https://nuova-onda-box.pages.dev`. Accedi con
`admin` / `nuovaonda2024`.

> In alternativa al passaggio 3–4 puoi fare tutto da terminale:
> `npm run deploy` (dopo aver inserito il `database_id` in `wrangler.toml`).

---

## Sviluppo in locale

```bash
npm install
npm run dev          # frontend Next.js su http://localhost:3000
```

Per provare in locale l'intero stack (frontend statico + Functions + D1 emulato):

```bash
npm run pages:dev    # build + wrangler pages dev (D1 locale in .wrangler/)
```

## Struttura del progetto

| Percorso             | Contenuto                                              |
| -------------------- | ------------------------------------------------------ |
| `app/`               | Frontend Next.js (App Router, static export)           |
| `components/`        | Schermate: Login, Clienti, Articoli, Entrata/Uscita, Produzione, Magazzino, Da ordinare, Utenti… |
| `lib/`               | Modello dati, store Zustand, sincronizzazione cloud    |
| `functions/api/db.ts`| API condivisa (Pages Function) con persistenza su D1   |
| `wrangler.toml`      | Configurazione Cloudflare (nome progetto, output, D1)  |
| `public/`            | Asset statici, manifest PWA, service worker            |
