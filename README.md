# Demo Raffle v1

En webbapplikation för Twitch streamers som låter tittare anmäla sig för att få sina demos spelade. Systemet använder en viktad lottning baserad på användares Twitch-engagement (subscriptions, bits, donations, etc.).

**📖 Se [docs/architecture/ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md) för komplett teknisk dokumentation.**  
**⚠️ Se [docs/reference/DOCUMENTATION_VERSIONS.md](./docs/reference/DOCUMENTATION_VERSIONS.md) för version-specifik dokumentation och vanliga fallgropar.**  
**📚 All dokumentation finns i [docs/](./docs/) mappen.**

## Funktioner

- ✅ **Twitch OAuth Login** - Användare måste logga in med Twitch och följa kanalen
- ✅ **Viktad Lottning** - Win probability baserad på Twitch-engagement (subs, bits, donations, gifted subs)
- ✅ **Realtidsuppdateringar** - Live updates via Twitch EventSub webhooks
- ✅ **Leaderboard** - Top 20 submissions med live win probability %
- ✅ **Status-indikator** - Visar om submissions är öppna/stängda
- ✅ **Anti-Whale System** - Caps på weights och återställning vid vinst
- ✅ **Carry-over Weight** - Non-winners får bonus-weight till nästa stream
- ✅ **Admin Panel** - Dra vinnare, hantera streams

## Teknikstack

- **Next.js 16** (App Router) - React-ramverk med serverless functions
- **NextAuth.js v5** - Twitch OAuth-autentisering
- **Prisma 6** - ORM för databashantering
- **PostgreSQL** - Relationsdatabas
- **TypeScript** - Typsäkerhet
- **Tailwind CSS 4** - Utility-first CSS
- **Twitch API (Helix + EventSub)** - Användardata och real-time events

## Kom igång

### 1. Installation

```bash
npm install
```

### 2. Konfigurera databas

Du behöver skapa en `.env`-fil i projektroten med följande innehåll:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"
# DIRECT_URL is required by Prisma schema. For non-Supabase users, set it to the same value as DATABASE_URL.
# For Supabase users, set DIRECT_URL to the direct connection (port 5432) - see docs/setup/SUPABASE_SETUP.md
DIRECT_URL="postgresql://user:password@host:port/database"

# Admin
ADMIN_TOKEN="ditt-hemliga-admin-token"

# Twitch OAuth
TWITCH_CLIENT_ID="your_twitch_client_id"
TWITCH_CLIENT_SECRET="your_twitch_client_secret"
TWITCH_BROADCASTER_ID="your_broadcaster_user_id"

# Twitch Webhooks
TWITCH_WEBHOOK_SECRET="your_webhook_secret"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your_nextauth_secret"
```

**Viktigt om DIRECT_URL:**
- **För Supabase**: Se [docs/setup/SUPABASE_SETUP.md](./docs/setup/SUPABASE_SETUP.md) för instruktioner om att hämta både `DATABASE_URL` (pooled) och `DIRECT_URL` (direct connection).
- **För andra databaser** (Railway, Neon, etc.): Sätt `DIRECT_URL` till samma värde som `DATABASE_URL`.
- Om `DIRECT_URL` inte är satt, kommer appen automatiskt använda `DATABASE_URL` som fallback (men det rekommenderas att sätta det explicit).

**För att skapa en molndatabas via Prisma:**
```bash
npx prisma init --db
```

Detta kommer att skapa en ny PostgreSQL-databas och lägga till `DATABASE_URL` i din `.env`-fil automatiskt.

**Alternativt:** Använd en egen PostgreSQL-instans och uppdatera `DATABASE_URL` manuellt.

### 3. Konfigurera Prisma

När databasen är konfigurerad, kör migrationer:

```bash
npx prisma migrate dev --name init
```

Detta skapar databastabellen enligt schemat i `prisma/schema.prisma`.

### 4. Generera Prisma Client

```bash
npx prisma generate
```

(Detta körs automatiskt vid `npm install` tack vare `postinstall`-scriptet.)

### 5. Starta utvecklingsservern

```bash
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000) i din webbläsare.

## Användning

### För deltagare

1. Besök startsidan på `/`
2. Fyll i formuläret med namn och e-post
3. Klicka på "Anmäl mig"
4. När en vinnare har utsetts visas resultatet automatiskt på startsidan

### För administratörer

1. Besök admin-sidan på `/admin`
2. Logga in (enkel lösenordskontroll på klientsidan)
3. Ange din admin-token (från `ADMIN_TOKEN` miljövariabeln)
4. Klicka på "Dra vinnare" för att slumpmässigt välja en vinnare
5. Vinnaren markeras i databasen och visas på startsidan

## Databasschema

Projektet använder följande modell:

```prisma
model Entry {
  id        Int      @id @default(autoincrement())
  name      String
  email     String   @unique
  createdAt DateTime @default(now())
  isWinner  Boolean  @default(false)
}
```

## API Routes

### Publika
- `GET /api/winner` - Hämta nuvarande vinnare
- `GET /api/leaderboard` - Top 20 submissions med win probability

### Autentiserade (Twitch login krävs)
- `POST /api/enter` - Anmäl sig till raffle (kräver Twitch login + follow)
- `POST /api/twitch/sync` - Synka användares Twitch-data

### Admin (ADMIN_TOKEN krävs)
- `POST /api/pick-winner` - Dra en vinnare (weighted random)
- `POST /api/demo-played` - Markera att demo spelats
- `POST /api/twitch/update-weights` - Uppdatera alla weights
- `POST /api/twitch/carry-over` - Carry over weights till nästa stream

### Webhooks
- `POST /api/twitch/webhook` - Twitch EventSub webhook handler

## Driftsättning

**📖 Se [docs/deployment/DEPLOYMENT.md](./docs/deployment/DEPLOYMENT.md) för komplett deployment-guide med alla steg.**

### Snabbstart till Vercel

1. Pusha koden till GitHub
2. Skapa konto på [Vercel](https://vercel.com) och logga in med GitHub
3. Importera projekt från GitHub (Vercel auto-detekterar Next.js)
4. Lägg till alla miljövariabler i Vercel Project Settings:
   - `DATABASE_URL` - PostgreSQL connection string
   - `ADMIN_TOKEN` - Hemligt admin-token
   - `TWITCH_CLIENT_ID` - Din Twitch app Client ID
   - `TWITCH_CLIENT_SECRET` - Din Twitch app Client Secret
   - `TWITCH_BROADCASTER_ID` - Din Twitch User ID
   - `TWITCH_WEBHOOK_SECRET` - Hemligt webhook secret
   - `NEXTAUTH_URL` - Din produktion URL (t.ex. `https://projekt.vercel.app`)
   - `NEXTAUTH_SECRET` - Hemligt NextAuth secret
5. Deploya projektet

**Viktigt**: 
- Efter deployment måste du registrera Twitch EventSub webhooks för real-time updates
- Se [docs/deployment/DEPLOYMENT.md](./docs/deployment/DEPLOYMENT.md) för detaljerade instruktioner om webhooks, troubleshooting och security

## Säkerhet

- Admin-token lagras i miljövariabler och exponeras aldrig i klientkod
- API-routes validerar all indata
- E-postadresser är unika i databasen (förhindrar dubbelanmälningar)
- Formulärdata saneras och valideras innan lagring

## Utveckling

### Prisma Studio

För att granska databasen visuellt:

```bash
npx prisma studio
```

Detta öppnar en webbgränssnitt där du kan se och redigera data.

### Linting

```bash
npm run lint
```

## Licens

Privat projekt - Används för interna utlottningar
