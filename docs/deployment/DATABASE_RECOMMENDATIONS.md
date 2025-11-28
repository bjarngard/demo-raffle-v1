# PostgreSQL Database Recommendations

Rekommendationer för vilken PostgreSQL-databas du ska använda baserat på ditt scenario.

## 🎯 Snabb Rekommendation

**För de flesta användare**: **Supabase** (gratis tier, enkel setup, bra för små/medelstora projekt)

**För seriös produktion**: **Railway** eller **Neon** (mer robust, bättre support)

---

## 📊 Jämförelse

| Tjänst | Gratis Tier | Kostnad | Setup | Scala | Rekommendation |
|--------|-------------|---------|-------|-------|----------------|
| **Supabase** | ✅ 500MB, 2GB bandwidth | $25/mån från tier 2 | ⭐⭐⭐⭐⭐ Mycket enkel | ⭐⭐⭐⭐ Bra | ⭐⭐⭐⭐⭐ Bäst för de flesta |
| **Railway** | ❌ $5 credit | $5-20/mån | ⭐⭐⭐⭐ Enkel | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐⭐ Bäst för produktion |
| **Neon** | ✅ 0.5GB, 1 branch | $19/mån från paid | ⭐⭐⭐⭐ Enkel | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Bra alternativ |
| **Render** | ✅ 90 dagar trial | $7/mån | ⭐⭐⭐⭐ Enkel | ⭐⭐⭐⭐ Bra | ⭐⭐⭐ OK |
| **Prisma Data Platform** | ❌ Betald | Varierar | ⭐⭐⭐ Medel | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐ Om du redan använder Prisma |
| **Vercel Postgres** | ❌ Betald | $20/mån | ⭐⭐⭐⭐⭐ Mycket enkel | ⭐⭐⭐ Bra | ⭐⭐⭐ Om du använder Vercel |

---

## 🏆 Detaljerade Rekommendationer

### 1. Supabase (Rekommenderat för de flesta) ⭐⭐⭐⭐⭐

**Perfekt för**: Små till medelstora projekt, learning, MVP

**Fördelar:**
- ✅ **100% gratis** för små projekt (500MB database, 2GB bandwidth)
- ✅ Mycket enkel setup (5 minuter)
- ✅ Inbyggt dashboard med visualiseringsverktyg
- ✅ Automatiska backups
- ✅ Connection pooling inbyggt
- ✅ Bra dokumentation
- ✅ Användarvänlig GUI för att se data
- ✅ Row Level Security stöd (används inte här men bra att ha)

**Nackdelar:**
- ⚠️ Gratis tier har begränsningar (500MB, 2GB bandwidth)
- ⚠️ Kan bli långsammare vid hög trafik (men OK för raffle-app)

**Kostnad:**
- **Gratis**: 500MB database, 2GB bandwidth
- **Pro ($25/mån)**: 8GB database, 50GB bandwidth

**Setup:**
1. Gå till https://supabase.com
2. Skapa konto (gratis)
3. Klicka "New Project"
4. Välj namn och region (närmast dig)
5. Ange database password
6. Vänta 2 minuter (projekt skapas)
7. Gå till Project Settings → Database
8. Kopiera "Connection string" (URI format)

**Connection String format:**
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

---

### 2. Railway (Bäst för produktion) ⭐⭐⭐⭐⭐

**Perfekt för**: Seriös produktion, när du behöver mer kontroll

**Fördelar:**
- ✅ **$5 gratis credit** för nya användare
- ✅ Mycket bra prestanda
- ✅ Automatiska backups
- ✅ Easy scaling
- ✅ Bra monitoring dashboard
- ✅ Connection pooling med PgBouncer
- ✅ Support för Prisma migrations
- ✅ Generös gratis tier efter initial credit

**Nackdelar:**
- ⚠️ Något mer komplex setup än Supabase (men fortfarande enkelt)
- ⚠️ Kostar ~$5-20/mån efter gratis credit

**Kostnad:**
- **Starter**: $5/mån (1GB RAM, 10GB disk)
- **Developer**: $20/mån (2GB RAM, 20GB disk)

**Setup:**
1. Gå till https://railway.app
2. Skapa konto (gratis med $5 credit)
3. Klicka "New Project"
4. Välj "Provision PostgreSQL"
5. Vänta 1 minut
6. Klicka på PostgreSQL-servern
7. Gå till "Variables" tab
8. Kopiera `DATABASE_URL`

**Connection String:**
Railway ger dig automatiskt `DATABASE_URL` i environment variables.

---

### 3. Neon (Modern alternativ) ⭐⭐⭐⭐

**Perfekt för**: När du vill ha modern features som branching

**Fördelar:**
- ✅ **Gratis tier**: 0.5GB storage, unlimited branches
- ✅ Serverless PostgreSQL (skalbar)
- ✅ Database branching (som git branches!)
- ✅ Automatiska backups
- ✅ Connection pooling inbyggt
- ✅ Mycket snabb

**Nackdelar:**
- ⚠️ Något nyare tjänst (men mycket stabil)
- ⚠️ Gratis tier är begränsad (men tillräckligt för många)

**Kostnad:**
- **Free**: 0.5GB, 1 branch
- **Launch ($19/mån)**: 10GB, unlimited branches

**Setup:**
1. Gå till https://neon.tech
2. Skapa konto
3. Klicka "Create Project"
4. Välj namn och region
5. Klicka "Create"
6. Connection string visas direkt

---

### 4. Render (Solid alternativ) ⭐⭐⭐

**Perfekt för**: Om du vill ha enkel setup med trial period

**Fördelar:**
- ✅ 90 dagars gratis trial
- ✅ Enkel setup
- ✅ Automatiska backups
- ✅ OK prestanda

**Nackdelar:**
- ⚠️ Begränsad gratis tier (bara 90 dagar)
- ⚠️ Något långsammare än Railway/Neon

**Kostnad:**
- **Trial**: 90 dagar gratis
- **Standard**: $7/mån (1GB RAM, 10GB storage)

**Setup:**
1. Gå till https://render.com
2. Skapa konto
3. Klicka "New" → "PostgreSQL"
4. Fyll i namn och välj plan
5. Vänta 2 minuter
6. Gå till PostgreSQL-servern → kopiera "Internal Database URL"

---

### 5. Vercel Postgres (Om du använder Vercel)

**Perfekt för**: Om du redan deployar på Vercel och vill ha allt på samma ställe

**Fördelar:**
- ✅ Integrerar perfekt med Vercel
- ✅ Environment variables sätts automatiskt
- ✅ Mycket enkel setup

**Nackdelar:**
- ⚠️ Kostar minst $20/mån
- ⚠️ Bunden till Vercel
- ⚠️ Mindre flexibel än andra alternativ

**Kostnad:**
- **Hobby**: $20/mån (64MB RAM, 256MB storage)
- **Pro**: $20/mån + usage

**Setup:**
1. I Vercel Dashboard → ditt projekt
2. Gå till Storage tab
3. Klicka "Create Database"
4. Välj "Postgres"
5. Välj plan
6. `DATABASE_URL` sätts automatiskt!

---

## 🎯 Min Slutsats

### För Raffle Appen specifikt:

**Start med Supabase** om:
- Du testar/appen är liten
- Du vill ha gratis option
- Du vill ha enkelt dashboard för att se data
- Du är OK med 500MB gratis tier

**Upgrade till Railway** när:
- Du får mycket trafik
- Du behöver mer än 500MB
- Du vill ha mer robust setup
- Kostnad (~$5-20/mån) är OK

### Migration mellan tjänster:

Du kan alltid migrera senare! Prisma migrations gör det enkelt:
```bash
# Nya DATABASE_URL
npx prisma migrate deploy
```

All data migreras automatiskt.

---

## 📝 Snabb Start Guide

**📖 Se [../setup/SUPABASE_SETUP.md](../setup/SUPABASE_SETUP.md) för komplett steg-för-steg guide med alla detaljer.**

### Supabase (5 minuter)

1. **Skapa projekt:**
   - Gå till https://supabase.com → Sign up
   - Klicka "New Project"
   - Namn: `demo-raffle-db`
   - Region: närmast dig (t.ex. `West Europe`)
   - Password: Skapa starkt lösenord (spara det!)
   - Klicka "Create new project"

2. **Konfigurera anslutning:**
   - När projektet skapas, du får en konfigurationsskärm
   - **Välj "Only Connection String"** (INTE "Data API + Connection String")
     - *Varför?* Prisma använder direkt PostgreSQL-protokoll, inte Supabase Data API
   - Data API configuration spelar ingen roll om du väljer "Only Connection String"
   - Klicka "Continue" eller "Next"

3. **Välj Postgres Type (Advanced Configuration):**
   - **Välj "Postgres"** (standard, redan vald)
     - ✅ Rekommenderat för produktion
     - ✅ Stabil och kompatibel med Prisma
   - **Undvik "Postgres with OrioleDB"** (Alpha, experimentell)
   - Klicka "Continue" eller "Next"

4. **Hämta connection strings (VIKTIGT!):**
   - Gå till Project Settings → Database
   - Scrolla ner till "Connection string"
   - Du behöver **TVÅ** connection strings:
   
   **a) Direct Connection (för migrations):**
   - Välj "URI" tab
   - Välj "Direct connection" (port 5432)
   - Kopiera connection string
   - **Ersätt `[YOUR-PASSWORD]` med ditt lösenord**
   - Format: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
   - **Spara som `DIRECT_URL` i `.env`**
   
   **b) Pooled Connection (för applikationen - Vercel/Serverless):**
   - Välj **"Transaction mode"** (port 6543) - rätt för serverless/Vercel
   - Kopiera connection string
   - **Ersätt `[YOUR-PASSWORD]` med ditt lösenord**
   - Format: `postgres://postgres:[PASSWORD]@db.xxxxx.supabase.co:6543/postgres`
   - **Spara som `DATABASE_URL` i `.env`**
   - ⚠️ Transaction mode stödjer INTE prepared statements - Prisma hanterar detta automatiskt
   
   **Varför två connection strings?**
   - Direct connection (5432): Används av Prisma Migrate för att skapa tabeller
   - Transaction mode (6543): Används av applikationen i serverless (Vercel) för bättre prestanda och connection pooling

5. **Uppdatera Prisma Schema:**
   - Öppna `prisma/schema.prisma`
   - Uppdatera `datasource`-blocket:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")      // Pooled connection (för appen)
     directUrl = env("DIRECT_URL")        // Direct connection (för migrations) - endast för Supabase
   }
   ```
   **OBS**: `directUrl` är valfritt och används bara för Supabase. För andra databaser (Railway, Neon, etc.) behöver du bara `DATABASE_URL`.

6. **Lägg till i `.env`-filen:**
   ```env
   # Supabase Connection Strings
   # Transaction mode (för applikationen - Vercel/Serverless)
   DATABASE_URL="postgres://postgres:[PASSWORD]@db.xxxxx.supabase.co:6543/postgres"
   # Direct connection (för migrations)
   DIRECT_URL="postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres"
   ```
   **OBS**: Ersätt `[PASSWORD]` och `xxxxx` med dina värden!

7. **Kör migrations:**
   ```bash
   # Generera Prisma Client
   npx prisma generate
   
   # Kör migrations (använder DIRECT_URL automatiskt)
   npx prisma migrate deploy
   ```
   
   **OBS**: För första gången, använd:
   ```bash
   npx prisma migrate dev --name init
   ```

8. **Testa connection:**
   ```bash
   # Testa att Prisma kan ansluta
   npx prisma db pull
   ```
   
   Om det fungerar, ser du alla tabeller i din databas!

**Klart!** 🎉

---

## ⚠️ Viktiga Noteringar

1. **Backups**: Supabase, Railway, Neon har alla automatiska backups - inget du behöver tänka på.

2. **Connection Pooling (VIKTIGT för Vercel/Serverless):**
   Supabase erbjuder connection pooling via Supavisor:
   - **Direct Connection (port 5432)**: Används av Prisma Migrate för att skapa tabeller
   - **Transaction Mode (port 6543)**: Används av applikationen i serverless (Vercel) för bättre prestanda
   - **Välj "Transaction mode"** för serverless/Vercel deployment
   - Du behöver **BÅDA** connection strings i `.env`:
     - `DATABASE_URL` = Transaction mode (6543) - för applikationen
     - `DIRECT_URL` = Direct (5432) - för migrations
   - Uppdatera `prisma/schema.prisma` med `directUrl = env("DIRECT_URL")`
   - ⚠️ Transaction mode stödjer INTE prepared statements - Prisma hanterar detta automatiskt
   
   **Varför?** Serverless-funktioner (Vercel) kan skapa många transient connections. Transaction mode pooler delar connections mellan queries och förbättrar prestanda.
   
   **Andra tjänster:**
   - Railway: Har PgBouncer inbyggt (använd samma connection string)
   - Neon: Har connection pooling inbyggt (använd pooler-URL)

3. **Security**: 
   - Använd **ALDRIG** database password i kod
   - Lägg alltid i environment variables
   - Supabase/Railway/Neon ger dig säkra connection strings

4. **Monitoring**: 
   - Supabase: Inbyggt dashboard
   - Railway: Metrics dashboard
   - Neon: Web dashboard

---

## 🆘 Behöver du hjälp?

Välj en tjänst och följ stegen ovan. Om du fastnar, se:
- Supabase docs: https://supabase.com/docs
- Railway docs: https://docs.railway.app
- [DEPLOYMENT.md](./DEPLOYMENT.md) för mer information

