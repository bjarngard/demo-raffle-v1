# Supabase Setup Guide - Demo Raffle v1

Komplett steg-för-steg guide för att sätta upp Supabase för denna applikation.

## 🎯 Översikt

Denna app använder **Prisma** med **PostgreSQL** via Supabase. För att fungera optimalt i serverless-miljö (Vercel) behöver vi **två** connection strings:
- **Direct Connection** (port 5432): För Prisma Migrate
- **Pooled Connection** (port 6543): För applikationen

---

## 📋 Steg 1: Skapa Supabase Projekt

1. Gå till https://supabase.com
2. Klicka "Sign up" eller "Start your project"
3. Logga in med GitHub, Google, eller email
4. Klicka "New Project"

### Projektinställningar:

- **Name**: `demo-raffle-db` (eller valfritt namn)
- **Database Password**: 
  - Skapa ett **starkt lösenord** (minst 12 tecken)
  - **SPARA DETTA LÖSENORD!** Du behöver det senare
  - Tips: Använd en lösenordshanterare
- **Region**: Välj närmast dig (t.ex. `West Europe` för Sverige)
- **Pricing Plan**: Välj "Free" (gratis tier är tillräckligt för att börja)

5. Klicka "Create new project"
6. Vänta 2-3 minuter medan projektet skapas

---

## ⚙️ Steg 2: Konfigurera Anslutning

När projektet skapas, du får en konfigurationsskärm:

### 2.1 Connection Type

**Välj: "Only Connection String"**
- ❌ INTE "Data API + Connection String"
- ✅ "Only Connection String"

**Varför?** Prisma använder direkt PostgreSQL-protokoll, inte Supabase Data API.

Klicka "Continue" eller "Next"

### 2.2 Postgres Type (Advanced Configuration)

**Välj: "Postgres"** (standard, redan vald)
- ✅ Rekommenderat för produktion
- ✅ Stabil och kompatibel med Prisma
- ❌ INTE "Postgres with OrioleDB" (Alpha, experimentell)

Klicka "Continue" eller "Next"

---

## 🔗 Steg 3: Hämta Connection Strings

Du behöver **TVÅ** connection strings för att appen ska fungera optimalt:

1. Gå till **Project Settings** → **Database**
2. Scrolla ner till "Connection string"

### 3.1 Direct Connection (för migrations)

1. I "Connection String" tab:
   - **Type**: Välj **"URI"** (standard PostgreSQL connection string format)
     - ✅ Detta är rätt för Prisma
     - Alternativen (Node.js, Python, etc.) är bara exempel-kod, URI ger dig connection string direkt
   - **Source**: Välj **"Primary Database"** (standard)
   - **Method**: Se till att **"Direct connection"** (port 5432) är vald
2. Kopiera connection string från **"Database URL"**-fältet
3. **Ersätt `[YOUR-PASSWORD]` med ditt lösenord**

**Format:**
```
postgresql://postgres:[DITT-LÖSENORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

**Spara detta som `DIRECT_URL`** (används av Prisma Migrate)

### 3.2 Pooled Connection (för applikationen - Vercel/Serverless)

Enligt [Supabase-dokumentationen](https://supabase.com/docs/guides/database/connecting-to-postgres) ska du använda **Supavisor Transaction Mode** för serverless-miljöer (Vercel).

1. I samma "Connection String" tab:
   - **Type**: Välj **"URI"** (samma som ovan)
   - **Source**: Välj **"Primary Database"** (standard)
   - **Method**: Ändra dropdown till **"Transaction mode"** (port 6543)
   - ✅ **"Transaction mode"** är rätt för serverless/Vercel
   - ⚠️ **OBS**: Transaction mode stödjer INTE prepared statements - Prisma hanterar detta automatiskt
2. Kopiera connection string från **"Database URL"**-fältet (nu med port 6543)
3. **Ersätt `[YOUR-PASSWORD]` med ditt lösenord**

**Format:**
Supabase kan visa Transaction mode i två format (båda fungerar):

**Format 1 (Standard):**
```
postgres://postgres:[DITT-LÖSENORD]@db.[PROJECT-REF].supabase.co:6543/postgres
```
- Användarnamn: `postgres`
- Host: `db.[PROJECT-REF].supabase.co`
- Port: `6543`

**Format 2 (Pooler format - också korrekt):**
```
postgresql://postgres.[PROJECT-REF]:[DITT-LÖSENORD]@aws-1-[REGION].pooler.supabase.com:6543/postgres
```
- Användarnamn: `postgres.[PROJECT-REF]`
- Host: `aws-1-[REGION].pooler.supabase.com`
- Port: `6543`
- ✅ Båda formaten fungerar för Transaction mode!

**VIKTIGT - Skillnad mellan Session och Transaction mode:**
- **Session mode**: Port `5432`, användarnamn `postgres.[PROJECT-REF]`, host `pooler.supabase.com`
- **Transaction mode**: Port `6543` (detta är nyckeln!), kan ha antingen format ovan
  - ✅ Båda Transaction mode-format fungerar för Vercel/serverless!

**Spara detta som `DATABASE_URL`** (används av applikationen)

**Alternativ: Supavisor Session Mode (port 5432)**
Om du deployar på **persistent server** (inte Vercel) och behöver IPv4-stöd:
- Använd **"Session mode"** (port 5432) istället
- Format: `postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`
- Detta är ett alternativ till Direct Connection när IPv6 inte stöds
- Bäst för: Persistent backend services som kräver IPv4

**OBS**: Om du ser en varning om "Not IPv4 compatible", använd Transaction mode (6543) för applikationen!

### Varför två connection strings?

Enligt [Supabase-dokumentationen](https://supabase.com/docs/guides/database/connecting-to-postgres):

- **Direct Connection (5432)**: 
  - Används av Prisma Migrate för att skapa/modifiera tabeller
  - Bäst för persistent servers (VMs, containers)
  - Använder IPv6 som standard
  - Ingen pooler-overhead

- **Supavisor Transaction Mode (6543)**:
  - Används av applikationen i serverless-miljö (Vercel)
  - Ideal för serverless/edge functions med många transient connections
  - Connection pooling förbättrar prestanda och begränsar antal samtidiga anslutningar
  - Stödjer både IPv4 och IPv6
  - ⚠️ Stödjer INTE prepared statements (Prisma hanterar detta automatiskt via connection string)
  - Port: 6543

- **Supavisor Session Mode (5432)** (alternativ):
  - För persistent backend services som kräver IPv4
  - Alternativ till Direct Connection när IPv6 inte stöds
  - Port: 5432 (separat server från Direct Connection)

**För Vercel deployment**: Använd **Transaction mode (6543)** för `DATABASE_URL` och Direct connection (5432) för `DIRECT_URL`.

---

## 📝 Steg 4: Uppdatera Prisma Schema

Öppna `prisma/schema.prisma` och uppdatera `datasource`-blocket:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooled connection (för appen)
  directUrl = env("DIRECT_URL")        // Direct connection (för migrations)
}
```

**OBS**: 
- För **Supabase**: Du behöver både `DATABASE_URL` (pooled) och `DIRECT_URL` (direct)
- För **andra databaser** (Railway, Neon, etc.): 
  - Antingen kommentera ut `directUrl`-raden i `schema.prisma`
  - Eller sätt `DIRECT_URL` till samma värde som `DATABASE_URL`

---

## 🔐 Steg 5: Lägg till i .env

Öppna `.env`-filen i projektroten och lägg till:

```env
# Supabase Connection Strings
# Transaction mode (för applikationen - Vercel/Serverless)
DATABASE_URL="postgres://postgres:[DITT-LÖSENORD]@db.[PROJECT-REF].supabase.co:6543/postgres"

# Direct connection (för migrations)
DIRECT_URL="postgresql://postgres:[DITT-LÖSENORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
```

**OBS**: 
- `DATABASE_URL` använder `postgres://` (inte `postgresql://`) för Transaction mode
- Inga extra query parameters behövs - Prisma hanterar prepared statements automatiskt

**Ersätt:**
- `[DITT-LÖSENORD]` med lösenordet du skapade i steg 1
- `[PROJECT-REF]` med ditt projekts referens (finns i Supabase Dashboard → Settings → General → Reference ID)

**Exempel:**
```env
# Transaction mode (port 6543) - för applikationen
DATABASE_URL="postgres://postgres:MySecurePassword123@db.abcdefghijklmnop.supabase.co:6543/postgres"

# Direct connection (port 5432) - för migrations
DIRECT_URL="postgresql://postgres:MySecurePassword123@db.abcdefghijklmnop.supabase.co:5432/postgres"
```

**OBS**: 
- `DATABASE_URL` kan använda antingen `postgres://` eller `postgresql://` - båda fungerar
- Inga extra query parameters behövs (Prisma hanterar prepared statements automatiskt)

---

## 🚀 Steg 6: Kör Migrations

Nu när connection strings är konfigurerade, kör migrations:

```bash
# 1. Generera Prisma Client
npx prisma generate

# 2. Kör migrations (för första gången)
npx prisma migrate dev --name init

# Eller om du redan har migrations:
npx prisma migrate deploy
```

**Vad händer?**
- Prisma använder `DIRECT_URL` för att skapa tabeller
- Alla modeller från `schema.prisma` skapas i databasen
- Du ser output med alla skapade tabeller

---

## ✅ Steg 7: Verifiera Setup

Testa att allt fungerar:

```bash
# Testa connection
npx prisma db pull

# Öppna Prisma Studio (valfritt)
npx prisma studio
```

**Prisma Studio** öppnar en webbläsare där du kan se och redigera data i databasen.

---

## 🎯 Steg 8: Deployment till Vercel

När du deployar till Vercel, lägg till **BÅDA** environment variables:

1. Gå till Vercel Dashboard → ditt projekt → Settings → Environment Variables
2. Lägg till:
   - `DATABASE_URL` = Pooled connection (6543)
   - `DIRECT_URL` = Direct connection (5432)
3. Deploy igen

**OBS**: Vercel kör migrations automatiskt via `postinstall` script i `package.json`.

---

## 🔍 Troubleshooting

### Fel: "Connection refused" eller "Connection timeout"

**Lösning:**
- Kontrollera att lösenordet är korrekt (ingen `[YOUR-PASSWORD]` kvar)
- Kontrollera att `PROJECT-REF` är korrekt
- Testa connection i Supabase Dashboard → SQL Editor → kör `SELECT 1;`

### Fel: "Too many connections"

**Lösning:**
- Se till att du använder **pooled connection** (port 6543) för `DATABASE_URL`
- Kontrollera att `?pgbouncer=true` finns i connection string

### Fel: "Migration failed"

**Lösning:**
- Se till att `DIRECT_URL` är korrekt (port 5432, INTE 6543)
- Kontrollera att `directUrl` finns i `prisma/schema.prisma`

### Fel: "Prisma Client not generated"

**Lösning:**
```bash
npx prisma generate
```

---

## 📚 Ytterligare Resurser

- [Supabase Docs](https://supabase.com/docs)
- [Prisma + Supabase Guide](https://supabase.com/docs/guides/database/prisma)
- [Connection Pooling](https://supabase.com/docs/guides/database/connecting-to-postgres#connection-pooler)
- [../deployment/DEPLOYMENT.md](../deployment/DEPLOYMENT.md) - Fullständig deployment guide

---

## ✅ Checklista

- [ ] Supabase projekt skapat
- [ ] "Only Connection String" valt
- [ ] "Postgres" (standard) valt
- [ ] Direct connection (5432) kopierad → `DIRECT_URL`
- [ ] Pooled connection (6543, Transaction mode) kopierad → `DATABASE_URL`
- [ ] `prisma/schema.prisma` uppdaterad med `directUrl`
- [ ] `.env`-filen uppdaterad med båda connection strings
- [ ] Migrations kört (`npx prisma migrate deploy`)
- [ ] Connection verifierad (`npx prisma db pull`)
- [ ] Environment variables lagt till i Vercel (om deployar)

**Klart!** 🎉 Din Supabase-databas är nu redo att användas!

