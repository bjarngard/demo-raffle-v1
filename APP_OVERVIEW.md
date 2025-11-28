# Demo Raffle v1 - Komplett Appöversikt

> En omfattande kartläggning av appens struktur, funktioner, komponenter och tekniska implementationer för utvecklare och utomstående.

---

## 📋 Innehållsförteckning

1. [Appens Syfte och Funktion](#appens-syfte-och-funktion)
2. [Teknisk Stack](#teknisk-stack)
3. [Projektstruktur](#projektstruktur)
4. [Databasmodeller](#databasmodeller)
5. [API Routes](#api-routes)
6. [Frontend-sidor och Komponenter](#frontend-sidor-och-komponenter)
7. [Viktiga Funktioner och Flows](#viktiga-funktioner-och-flows)
8. [Konfiguration](#konfiguration)
9. [Säkerhet och Autentisering](#säkerhet-och-autentisering)
10. [Deployment](#deployment)

---

## 🎯 Appens Syfte och Funktion

**Demo Raffle v1** är en webbapplikation för Twitch streamers som låter tittare anmäla sig för att få sina musikdemos spelade under streamen. Systemet använder en **viktad lottning** baserad på användares Twitch-engagement (subscriptions, bits, donations, gifted subs, etc.).

### Huvudfunktioner

- ✅ **Twitch OAuth Login** - Användare måste logga in med Twitch och följa kanalen
- ✅ **Viktad Lottning** - Win probability baserad på Twitch-engagement
- ✅ **Realtidsuppdateringar** - Live updates via Twitch EventSub webhooks
- ✅ **Leaderboard** - Top 20 submissions med live win probability %
- ✅ **Status-indikator** - Visar om submissions är öppna/stängda
- ✅ **Anti-Whale System** - Caps på weights och återställning vid vinst
- ✅ **Carry-over Weight** - Non-winners får bonus-weight till nästa stream
- ✅ **Admin Panel** - Dra vinnare, hantera streams, konfigurera weights

---

## 🛠 Teknisk Stack

### Frontend & Backend
- **Next.js 16.0.1** (App Router) - React-ramverk med serverless functions
- **TypeScript 5** - Typsäkerhet
- **Tailwind CSS 4** - Utility-first CSS framework
- **React 19.2.0** - UI-bibliotek

### Autentisering & Sessions
- **NextAuth.js v5.0.0-beta.30** - Autentisering med Twitch OAuth
- **@auth/prisma-adapter 2.11.1** - Databasbaserad session-hantering

### Databas & ORM
- **PostgreSQL** - Relationsdatabas (Supabase/Railway/Neon/etc.)
- **Prisma 6.18.0** - ORM för databashantering
- **@prisma/client 6.18.0** - Prisma Client

### Externa Integrationer
- **Twitch API (Helix)** - REST API för användardata
- **Twitch EventSub** - Webhooks för real-time events
- **@twurple/api 7.4.0** - Twitch API-klient
- **@twurple/auth 7.4.0** - Twitch OAuth-klient

### Validering & Utilities
- **Zod 4.1.12** - Schema-validering
- **dotenv 17.2.3** - Environment variables

---

## 📁 Projektstruktur

```
demo-raffle-v1/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (serverless functions)
│   │   ├── admin/                # Admin endpoints
│   │   │   ├── auth/             # Admin session status
│   │   │   ├── entries/          # Entry management (GET/DELETE)
│   │   │   ├── weight-settings/  # Weight configuration (GET/PUT)
│   │   │   └── dashboard/        # Combined admin data payload
│   │   ├── auth/                 # NextAuth routes
│   │   │   ├── [...nextauth]/   # OAuth callback handler
│   │   │   └── debug/            # Auth debugging
│   │   ├── enter/                # Entry submission
│   │   ├── leaderboard/          # Leaderboard data
│   │   ├── pick-winner/          # Draw winner (admin)
│   │   ├── twitch/               # Twitch integration
│   │   │   ├── sync/             # Sync user data
│   │   │   ├── update-weights/   # Recalculate weights
│   │   │   ├── carry-over/       # Carry over weights
│   │   │   ├── check-follow/     # Check follow status
│   │   │   └── webhook/          # EventSub webhook handler
│   │   ├── user/                 # User endpoints
│   │   ├── winner/               # Get winner
│   │   ├── demo-played/          # Mark demo as played
│   │   └── health/               # Health checks
│   ├── components/               # React components
│   │   ├── TwitchLogin.tsx       # Twitch auth button
│   │   ├── DemoSubmissionForm.tsx # Demo link form
│   │   ├── MyStatusCard.tsx      # User weight breakdown
│   │   ├── TopList.tsx           # Leaderboard list
│   │   ├── WeightTable.tsx       # Weight parameters table
│   │   ├── AdminUserTable.tsx    # Admin entry table
│   │   ├── AdminWeightsForm.tsx  # Weight settings form
│   │   └── RaffleWheel.tsx        # Animated raffle drawing
│   ├── admin/                    # Legacy admin page
│   ├── demo-admin/               # Full admin panel
│   │   ├── AdminDashboardClient.tsx # Client wrapper fed from server data
│   │   └── page.tsx              # Server component gatekeeping access
│   ├── demo-portal/              # User dashboard
│   ├── page.tsx                  # Landing page
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── lib/                          # Shared utilities
│   ├── auth.ts                   # NextAuth configuration
│   ├── admin-auth.ts             # Session-based admin guard
│   ├── prisma.ts                 # Prisma client
│   ├── env.ts                    # Environment validation
│   ├── twitch-api.ts             # Twitch API helpers
│   ├── weight-settings.ts        # Weight calculation
│   ├── admin-data.ts             # Shared admin data queries
│   ├── draw-lock.ts              # (Legacy) dev-only lock helper
│   └── rate-limit.ts             # (Legacy) dev-only limiter helper
├── prisma/                       # Database schema
│   ├── schema.prisma             # Prisma schema
│   └── migrations/                # Database migrations
├── types/                        # TypeScript types
│   └── next-auth.d.ts            # NextAuth type extensions
├── docs/                         # Documentation
│   ├── architecture/             # Technical architecture
│   ├── deployment/               # Deployment guides
│   ├── setup/                    # Setup guides
│   └── reference/                # Reference docs
├── auth.ts                       # NextAuth handler export
├── next.config.ts                # Next.js configuration
├── tsconfig.json                 # TypeScript config
├── package.json                  # Dependencies
└── vercel.json                   # Vercel configuration
```

---

## 📊 Databasmodeller

### User
Lagrar användarinfo från Twitch OAuth och engagement-data.

**Fält:**
- `id` (String, PK) - NextAuth user ID
- `twitchId` (String, unique) - Twitch user ID
- `username`, `displayName`, `email`, `image` - Twitch profile data
- `accessToken`, `refreshToken`, `tokenExpiresAt` - OAuth tokens
- `isSubscriber`, `isFollower` (Boolean) - Channel status
- `subMonths`, `totalSubs` (Int) - Subscription data
- `totalCheerBits`, `totalDonations` (Int) - Engagement metrics
- `resubCount`, `totalGiftedSubs` (Int) - Additional metrics
- `currentWeight`, `carryOverWeight`, `totalWeight` (Float) - Weight system
- `lastUpdated`, `createdAt`, `lastActive` (DateTime) - Timestamps

**Relationer:**
- `entries` → Entry[] (one-to-many)
- `sessions` → Session[] (one-to-many)
- `accounts` → Account[] (one-to-many)

### Entry
Lottningsanmälningar kopplade till användare.

**Fält:**
- `id` (Int, PK, auto-increment)
- `userId` (String?, FK) - Link to User
- `name` (String) - Display name
- `email` (String?, unique) - Email address
- `demoLink` (String?) - Demo URL (SoundCloud, Drive, etc.)
- `createdAt` (DateTime)
- `isWinner` (Boolean) - Winner flag
- `streamId` (String?) - Stream identifier

**Relationer:**
- `user` → User? (many-to-one, optional)

### Account & Session
NextAuth-relaterade modeller för OAuth-hantering.

**Account:**
- Lagrar OAuth provider data (Twitch)
- Kopplad till User via `userId`

**Session:**
- Lagrar session tokens
- Kopplad till User via `userId`

### ProcessedWebhookEvent
Spårar bearbetade Twitch EventSub-events för att förhindra duplicering.

**Fält:**
- `id` (String, PK)
- `messageId` (String, unique) - Twitch-Eventsub-Message-Id
- `eventType` (String) - subscription.type
- `twitchUserId` (String?) - user_id from event
- `processedAt` (DateTime)

**Indexes:**
- `messageId` (unique)
- `processedAt`

### WeightSettings
Lagrar weight calculation parameters (kan uppdateras via admin panel).

**Fält:**
- `id` (String, PK)
- `baseWeight` (Float, default: 1.0)
- `subMonthsMultiplier` (Float, default: 0.1)
- `subMonthsCap` (Int, default: 10)
- `resubMultiplier` (Float, default: 0.2)
- `resubCap` (Int, default: 5)
- `cheerBitsDivisor` (Float, default: 1000.0)
- `cheerBitsCap` (Float, default: 5.0)
- `donationsDivisor` (Float, default: 1000.0)
- `donationsCap` (Float, default: 5.0)
- `giftedSubsMultiplier` (Float, default: 0.1)
- `giftedSubsCap` (Float, default: 5.0)
- `carryOverMultiplier` (Float, default: 0.5)
- `createdAt`, `updatedAt` (DateTime)

**Caching:** 1 minut TTL för prestanda

---

## 🔌 API Routes

### Publika Routes

#### `GET /api/winner`
Hämta nuvarande vinnare.

**Response:**
```json
{
  "winner": {
    "id": 1,
    "name": "Username",
    "email": "user@example.com"
  } | null
}
```

#### `GET /api/leaderboard`
Hämta top 20 submissions med win probability.

**Response:**
```json
{
  "submissionsOpen": true,
  "totalEntries": 50,
  "entries": [
    {
      "id": 1,
      "name": "Username",
      "weight": 5.2,
      "probability": 10.4
    }
  ]
}
```

#### `GET /api/health/app`
Health check för applikationen.

#### `GET /api/health/db`
Health check för databasanslutning.

---

### Autentiserade Routes (Twitch Login krävs)

#### `POST /api/enter`
Anmäl sig till raffle (kräver Twitch login + follow).

**Request:**
```json
{
  "name": "Display Name (optional)",
  "demoLink": "https://soundcloud.com/..." (optional)
}
```

**Validering:**
- Kräver Twitch login
- Kräver channel follow
- Rate limiting: 5 submissions/user/hour, 10 submissions/IP/hour
- Demo link måste vara från SoundCloud, Google Drive, eller Dropbox
- En aktiv submission per användare

**Response:**
```json
{
  "success": true,
  "id": 1
}
```

#### `POST /api/twitch/sync`
Synka användares Twitch-data (subscriptions, bits, donations, etc.).

**Response:**
```json
{
  "success": true,
  "user": { ... }
}
```

#### `POST /api/twitch/check-follow`
Kontrollera om användaren följer kanalen.

**Response:**
```json
{
  "isFollower": true
}
```

#### `GET /api/user/submission`
Hämta användarens nuvarande submission.

**Response:**
```json
{
  "entry": {
    "id": 1,
    "name": "Username",
    "demoLink": "...",
    "isWinner": false
  } | null
}
```

---

### Admin Routes (NextAuth broadcastersession krävs)

Alla moderna admin-endpoints anropar `requireAdminSession`, vilket betyder att du måste vara inloggad via NextAuth med den verifierade broadcaster-användaren. Äldre `ADMIN_TOKEN` används endast av den legacy-sidan `/admin` och påverkar inte backendvalideringen.

#### `GET /api/admin/dashboard`
Returnerar en sammanställd payload (entries + weight settings) som används för att initialt hydrera adminpanelen på serversidan.

#### `GET /api/admin/entries`
Lista samtliga öppna entries med stöd för `search`, `sortBy` (`name`/`weight`) och `sortOrder` (`asc`/`desc`).

#### `DELETE /api/admin/entries/[id]`
Tar bort en specifik entry om den fortfarande är öppen (non-winner).

#### `GET /api/admin/weight-settings`
Returnerar aktuella weight-parametrar från `WeightSettings`-tabellen.

#### `PUT /api/admin/weight-settings`
Uppdaterar weight-parametrar (helt eller delvis) och returnerar den nya konfigurationen.

#### `GET /api/admin/auth`
Returnerar en enkel `{ authenticated: boolean, user: { ... } }` payload baserat på aktuell NextAuth-session (POST/DELETE är avstängda i produktion).

#### `POST /api/pick-winner`
Drar en vinnare via en transaktion som både markerar `Entry.isWinner` och nollställer vinnarens bonuspoäng; endast broadcaster-sessioner accepteras.

#### `POST /api/demo-played`
Tar en `userId` och nollställer den användarens bits/gifts samt triggar vikt-rekalkylering efter att en demo spelats upp.

#### `POST /api/twitch/update-weights`
Bulk-uppdaterar `currentWeight`/`totalWeight` (i batchar) baserat på nuvarande engagement-data; kan filtreras på `streamId`.

#### `POST /api/twitch/carry-over`
Beräknar och sparar `carryOverWeight` för alla non-winners (med möjlighet att nollställa via `resetWeights` flaggan) och kan begränsas till ett visst `streamId`.

---

### Webhooks

#### `POST /api/twitch/webhook`
Twitch EventSub webhook handler.

**Validering:**
- HMAC-SHA256 signaturverifiering
- Timestamp-validering (max 10 minuter gammal)
- Duplicate event detection
- Replay attack protection

**Event Types:**
- `channel.subscribe` - Subscription events
- `channel.subscription.gift` - Gifted subscriptions
- `channel.cheer` - Bits cheered
- `channel.follow` - Follow events

**Response:**
- `200 OK` för verification challenges
- `200 OK` för bearbetade events
- `400 Bad Request` för ogiltiga requests

---

## 🎨 Frontend-sidor och Komponenter

### Sidor

#### `/` (Landing Page)
**Fil:** `app/page.tsx`

**Funktion:**
- Visar raffle entry form (kräver Twitch login + follow)
- Visar top 20 leaderboard med live updates (5s polling)
- Visar status banner (submissions open/closed)
- Visar vinnare när raffle är klar

**Komponenter:**
- `TwitchLogin` - Twitch auth button
- `TopList` - Leaderboard list

**States:**
- Loading states för winner/leaderboard
- Error handling för API calls
- Follow status check

---

#### `/demo-portal` (User Dashboard)
**Fil:** `app/demo-portal/page.tsx`

**Funktion:**
- User dashboard med demo submission
- Visar user's weight breakdown
- Visar top 20 leaderboard
- Visar weight parameters table
- Status banner för submissions

**Komponenter:**
- `TwitchLogin` - Twitch auth button
- `DemoSubmissionForm` - Demo link form
- `MyStatusCard` - User weight breakdown
- `TopList` - Leaderboard list
- `WeightTable` - Weight parameters table

**Features:**
- Auto-refresh leaderboard (5s polling)
- Real-time weight updates
- Demo link validation

---

#### `/demo-admin` (Admin Panel)
**Fil:** `app/demo-admin/page.tsx`

**Funktion:**
- Full admin panel med tabs
- Entry management (search, sort, remove)
- Weight settings configuration
- Draw winner med animation

**Tabs:**
1. **Users** - Alla entries med search/sort/remove
2. **Weights** - Redigerbar weight settings form
3. **Raffle** - Draw winner button + Top 20 för stream

**Komponenter:**
- `AdminUserTable` - Entry table med search/sort
- `AdminWeightsForm` - Weight settings form
- `RaffleWheel` - Animerad raffle drawing
- `TopList` - Leaderboard list

**Features:**
- Server-side gate via NextAuth (endast broadcaster når sidan)
- Hämtar initial data via serverkomponent och `/api/admin/dashboard`
- Klientpollning för att hålla entries/leaderboard/weights färska
- Animated winner selection med `RaffleWheel`

---

#### `/admin` (Legacy Admin)
**Fil:** `app/admin/page.tsx`

**Funktion:**
- Enkel admin-sida för att dra vinnare (legacy)
- Används för bakåtkompatibilitet

---

### Komponenter

#### `TwitchLogin.tsx`
**Fil:** `app/components/TwitchLogin.tsx`

**Funktion:**
- Twitch authentication button
- Visar user info när inloggad
- Logout funktion

**Props:** Inga

**Features:**
- NextAuth session integration
- User profile display
- Logout handling

---

#### `DemoSubmissionForm.tsx`
**Fil:** `app/components/DemoSubmissionForm.tsx`

**Funktion:**
- Form för att skicka in demo link
- Validerar demo URL (SoundCloud, Drive, Dropbox)
- Visar existing submission om finns

**Props:** Inga

**Features:**
- URL validation
- Allowed domains check
- Existing submission display

---

#### `MyStatusCard.tsx`
**Fil:** `app/components/MyStatusCard.tsx`

**Funktion:**
- Visar user's total weight och breakdown
- Visar weight sources (subs, bits, donations, etc.)

**Props:** Inga

**Features:**
- Weight calculation display
- Breakdown by source
- Real-time updates

---

#### `TopList.tsx`
**Fil:** `app/components/TopList.tsx`

**Funktion:**
- Leaderboard lista (top 20)
- Visar namn, weight, och win probability

**Props:**
- `entries` - LeaderboardEntry[]
- `totalEntries` - number
- `submissionsOpen` - boolean

**Features:**
- Scrollable list
- Win probability display
- Real-time updates

---

#### `WeightTable.tsx`
**Fil:** `app/components/WeightTable.tsx`

**Funktion:**
- Tabell över weight parameters
- Visar alla weight settings

**Props:**
- `settings` - WeightSettings

**Features:**
- Read-only display
- Parameter explanations

---

#### `AdminUserTable.tsx`
**Fil:** `app/components/AdminUserTable.tsx`

**Funktion:**
- Tabell med alla entries
- Search och sort funktioner
- Remove entry funktion

**Props:**
- `entries` - Entry[]
- `onRemove` - (id: number) => void

**Features:**
- Search by name/email
- Sort by name/createdAt/weight
- Remove confirmation

---

#### `AdminWeightsForm.tsx`
**Fil:** `app/components/AdminWeightsForm.tsx`

**Funktion:**
- Redigerbar form för weight settings
- Uppdaterar weight parameters

**Props:** Inga

**Features:**
- Form validation
- Real-time updates
- Success/error feedback

---

#### `RaffleWheel.tsx`
**Fil:** `app/components/RaffleWheel.tsx`

**Funktion:**
- Animerad raffle drawing
- Scroll-effekt med winner highlight

**Props:**
- `entries` - Entry[]
- `winnerId` - number
- `seed` - number (för deterministisk animation)

**Features:**
- Smooth scroll animation
- Winner highlight
- Deterministic animation (seed-based)

---

#### `AdminDashboardClient.tsx`
**Fil:** `app/demo-admin/AdminDashboardClient.tsx`

**Funktion:**
- Hydrerar den moderna adminpanelen med server-förberedd data (entries + weight settings)
- Sköter polling mot `/api/admin/dashboard` och `/api/leaderboard`
- Exponerar callbacks som triggar refresh efter t.ex. winner-dragning

**Props:**
- `initialEntries` – Entrypayload från serverkomponenten
- `initialSettings` – Senaste weight settings

**Features:**
- Konsumerar NextAuth-sessionen indirekt via serverkomponenten
- Visar tabs (Users/Weights/Raffle)
- Triggar `RaffleWheel` och uppdaterar UI efter åtgärder

---

## 🔄 Viktiga Funktioner och Flows

### Twitch OAuth Flow

1. **User klickar "Sign in with Twitch"**
   - Redirect till Twitch OAuth
   - Scopes: `user:read:email`

2. **Twitch Callback**
   - NextAuth tar emot callback
   - `signIn` callback körs

3. **signIn Callback** (`lib/auth.ts`)
   - Hämtar användardata från Twitch API
   - Kontrollerar att användaren följer kanalen (**MÅSTE**)
   - Blockerar login om inte följare
   - Uppdaterar/lägger till användare i databas
   - Returnerar `true` för lyckad login

4. **Session Creation**
   - NextAuth skapar session
   - Session lagras i databas (Prisma Adapter)

---

### Weight Calculation Flow

1. **Weight Settings** (`lib/weight-settings.ts`)
   - Hämtar weight settings från databas (cached 1 min)
   - Default values om inga settings finns

2. **Weight Calculation** (`lib/twitch-api.ts`)
   - Baserat på user's engagement data:
     - **Base Weight**: 1.0
     - **Sub Months**: `min(subMonths * multiplier, cap)`
     - **Resubs**: `min(resubCount * multiplier, cap)`
     - **Cheer Bits**: `min(bits / divisor, cap)`
     - **Donations**: `min(donations / divisor, cap)`
     - **Gifted Subs**: `min(giftedSubs * multiplier, cap)`
     - **Carry-over**: `carryOverWeight * multiplier`

3. **Total Weight**
   - `totalWeight = baseWeight + sum(all sources)`
   - Lagras i `User.totalWeight`

4. **Win Probability**
   - `probability = (user.totalWeight / sum(all weights)) * 100`

---

### Raffle Drawing Flow

1. **Admin klickar "Draw Winner"**
   - `POST /api/pick-winner` anropas
   - Endast en inloggad NextAuth-session för broadcastern släpps igenom

2. **Transaktionsskydd**
   - Prisma-transaktionen läser + uppdaterar entryn i ett steg
   - Fungerar som global låsning även i serverless-miljöer

3. **Entry Selection**
   - Hämtar alla non-winner entries med user weights
   - Weighted random selection:
     ```typescript
     const random = Math.random() * totalWeight
     let sum = 0
     for (const entry of entries) {
       sum += entry.user.totalWeight
       if (random <= sum) return entry
     }
     ```

4. **Winner Update**
   - Transaction: Uppdaterar `Entry.isWinner = true`
   - Om user finns: Återställer `User.currentWeight = 1.0`
   - Returnerar winner data med seed för animation

5. **Client Animation**
   - `RaffleWheel` komponenten använder seed för deterministisk animation
   - Scroll-effekt med winner highlight

---

### Twitch EventSub Webhook Flow

1. **Webhook Registration**
   - Admin registrerar webhooks i Twitch Developer Console
   - Webhook URL: `https://your-domain.com/api/twitch/webhook`
   - Events: `channel.subscribe`, `channel.subscription.gift`, `channel.cheer`, `channel.follow`

2. **Webhook Verification** (`app/api/twitch/webhook/route.ts`)
   - Twitch skickar verification challenge
   - Appen returnerar `challenge` token

3. **Event Processing**
   - HMAC-SHA256 signaturverifiering
   - Timestamp-validering (max 10 minuter gammal)
   - Duplicate event detection (via `ProcessedWebhookEvent`)
   - Replay attack protection

4. **Data Update**
   - Uppdaterar user's engagement data i databas
   - Triggar weight recalculation om nödvändigt

---

### Carry-over Weight Flow

1. **Stream Ends**
   - Admin markerar demo som spelad (`POST /api/demo-played`)

2. **Carry-over Process** (`POST /api/twitch/carry-over`)
   - Hämtar alla non-winners för stream
   - Beräknar carry-over weight:
     ```typescript
     carryOverWeight = (totalWeight - baseWeight) * carryOverMultiplier
     ```
   - Uppdaterar `User.carryOverWeight`

3. **Next Stream**
   - När weights uppdateras, inkluderas carry-over weight
   - Non-winners får bonus-weight till nästa stream

---

## ⚙️ Konfiguration

### Miljövariabler

**Databas:**
```env
DATABASE_URL="postgresql://user:password@host:port/database"
DIRECT_URL="postgresql://user:password@host:port/database"
```
- `DATABASE_URL`: Pooled connection (för queries)
- `DIRECT_URL`: Direct connection (för migrations)
- För Supabase: Se `docs/setup/SUPABASE_SETUP.md`

**Twitch OAuth:**
```env
TWITCH_CLIENT_ID="your_twitch_client_id"
TWITCH_CLIENT_SECRET="your_twitch_client_secret"
TWITCH_BROADCASTER_ID="your_broadcaster_user_id"
```

**Twitch Webhooks:**
```env
TWITCH_WEBHOOK_SECRET="your_webhook_secret"
```

**NextAuth:**
```env
NEXTAUTH_URL="http://localhost:3000"  # Production: https://your-domain.com
NEXTAUTH_SECRET="your_nextauth_secret"  # Generate: openssl rand -base64 32
```

**Admin (endast legacy-/admin-sidan):**
```env
ADMIN_TOKEN="your-secret-admin-token"
```
`ADMIN_TOKEN` används bara av den äldre `/admin`-vyn som fortfarande har ett enkelt UI-lås; moderna admin-API:er förlitar sig på NextAuth-sessionen.

### Next.js Configuration

**`next.config.ts`:**
```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```

**`vercel.json`:**
```json
{
  "version": 2
}
```

### Prisma Configuration

**`prisma/schema.prisma`:**
- Datasource: PostgreSQL
- Connection pooling support (Supabase)
- Direct URL för migrations

---

## 🔐 Säkerhet och Autentisering

### Twitch OAuth Security

- **User Token**: Hämtas via NextAuth för varje tittare och används för individuella datahämtningssteg.
- **Broadcaster Token**: Kommer från broadcasterns eget NextAuth-konto (lagras i `Account` via Prisma) och auto-refreshas innan den används för scopes som `channel:read:subscriptions`, `moderator:read:followers` och `bits:read`.
- **Follow Check**: Obligatorisk channel follow för login
- **Token Refresh**: Hanteras centraliserat i `lib/twitch-oauth.ts` + NextAuth `jwt` callback

### Admin Authentication

- **Broadcaster-first**: `lib/admin-auth.ts` använder `auth()` och kräver att `session.user.isBroadcaster` är `true`.
- **NextAuth-sessioner**: Alla admin-endpoints körs i Vercels serverless-miljö och litar på samma HTTP-only sessioncookies som resten av appen.
- **Legacy token**: `ADMIN_TOKEN` existerar enbart för den äldre `/admin`-sidan; backend-validering baseras inte längre på denna token.

### Webhook Security

- **HMAC-SHA256**: Signaturverifiering
- **Timestamp Validation**: Max 10 minuter gammal
- **Duplicate Detection**: `ProcessedWebhookEvent` tabell
- **Replay Protection**: Message ID tracking

### API Security

- **Idempotenta endpoints**: Serverless funktionsflöden är utformade så att upprepade anrop inte skadar (rate-limit helpern är endast aktiv i lokal utveckling).
- **Input Validation**: Zod schemas
- **SQL Injection Protection**: Prisma parameterized queries
- **CORS**: Next.js default (same-origin)

---

## 🚀 Deployment

### Vercel (Rekommenderat)

1. **GitHub Integration**
   - Push till GitHub
   - Vercel auto-detekterar Next.js
   - Auto-deploy från `main` branch

2. **Environment Variables**
   - Lägg till alla miljövariabler i Vercel Dashboard
   - Se `docs/deployment/DEPLOYMENT.md` för lista

3. **Database Setup**
   - Supabase (rekommenderat): Se `docs/setup/SUPABASE_SETUP.md`
   - Railway, Neon, etc.: Se `docs/deployment/DATABASE_RECOMMENDATIONS.md`

4. **Twitch Webhooks**
   - Registrera webhooks i Twitch Developer Console
   - Webhook URL: `https://your-domain.com/api/twitch/webhook`
   - Se `docs/setup/TWITCH_SETUP.md`

5. **Custom Domain**
   - Lägg till custom domain i Vercel
   - Konfigurera DNS
   - Uppdatera `NEXTAUTH_URL`
   - Se `docs/deployment/CUSTOM_DOMAIN_SETUP.md`

### Build Process

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Prisma Generate**
   ```bash
   npx prisma generate
   ```
   (Körs automatiskt via `postinstall` script)

3. **Database Migrations**
   ```bash
   npx prisma migrate deploy
   ```
   (Körs automatiskt på Vercel)

4. **Build**
   ```bash
   npm run build
   ```

### Health Checks

- `GET /api/health/app` - App health
- `GET /api/health/db` - Database health

---

## 📚 Ytterligare Dokumentation

- **Teknisk Arkitektur**: `docs/architecture/ARCHITECTURE.md`
- **Version-specifik Dokumentation**: `docs/reference/DOCUMENTATION_VERSIONS.md`
- **Deployment Guide**: `docs/deployment/DEPLOYMENT.md`
- **Supabase Setup**: `docs/setup/SUPABASE_SETUP.md`
- **Twitch Setup**: `docs/setup/TWITCH_SETUP.md`

---

## 🎯 Sammanfattning

**Demo Raffle v1** är en komplett webbapplikation för Twitch streamers som kombinerar:

- **Modern Tech Stack**: Next.js 16, React 19, TypeScript, Prisma
- **Twitch Integration**: OAuth, EventSub webhooks, Helix API
- **Viktad Lottning**: Engagement-baserad win probability
- **Real-time Updates**: Live leaderboard och weight updates
- **Admin Tools**: Entry management, weight configuration, winner drawing
- **Säkerhet**: HMAC webhooks, rate limiting, input validation
- **Scalability**: Serverless functions, connection pooling, caching

Appen är designad för produktion med fokus på säkerhet, prestanda och användarupplevelse.

