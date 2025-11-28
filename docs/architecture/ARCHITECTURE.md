# Demo Raffle v1 - Arkitektur och Teknisk Översikt

## 🎯 Översikt

Ett webbaserat raffle-system för Twitch streamers som låter tittare anmäla sig för att få sina demos spelade. Systemet använder en viktad lottning baserad på användares Twitch-engagement (subscriptions, bits, donations, osv.).

---

## 🛠 Teknisk Stack

### Frontend & Backend
- **Next.js 16** (App Router) - React-ramverk med serverless functions
- **TypeScript** - Typsäkerhet
- **Tailwind CSS 4** - Utility-first CSS framework
- **React 19** - UI-bibliotek

### Autentisering & Sessions
- **NextAuth.js v5** - Autentisering med Twitch OAuth
- **Prisma Adapter** - Databasbaserad session-hantering

### Databas & ORM
- **PostgreSQL** - Relationsdatabas
- **Prisma 6** - ORM för databashantering

### Externa Integrationer
- **Twitch API (Helix)** - REST API för användardata
- **Twitch EventSub** - Webhooks för real-time events
- **@twurple/api** & **@twurple/auth** - Twitch API-klienter

---

## 📊 Databasstruktur

### Modeller

#### User
- Lagrar användarinfo från Twitch OAuth
- Twitch engagement data (subs, bits, donations, gifted subs)
- Weight-system (current, carry-over, total)
- Automatisk tracking av follower/subscriber status

#### Entry
- Lottningsanmälningar
- Länkad till User via Twitch-autentisering
- Support för streamId (flera streams)

#### Account & Session
- NextAuth-relaterade modeller för OAuth-hantering

#### ProcessedWebhookEvent
- Spårar bearbetade Twitch EventSub-events
- Förhindrar duplicerade events
- Replay attack protection

#### WeightSettings
- Lagrar weight calculation parameters
- Kan uppdateras via admin panel
- Caching (1 minut) för prestanda

---

## 🔐 Autentisering & Säkerhet

### Twitch OAuth Flow
1. Användare klickar "Sign in with Twitch"
2. OAuth-redirect till Twitch
3. Callback → NextAuth skapar session
4. `signIn` callback:
   - Hämtar användardata från Twitch API
   - Kontrollerar att användaren följer kanalen (**MÅSTE**)
   - Blockerar login om inte följare
   - Uppdaterar/lägger till användare i databas

### Token-system
- **User Token** (OAuth) - För användarens egna data
- **Broadcaster Token** (Client Credentials) - För att kolla follows/subs server-side
  - Hämtas automatiskt via client credentials grant
  - Cached för prestanda
  - Scopes: `channel:read:subscriptions`, `moderator:read:followers`, `bits:read`

### Admin-autentisering
- API-routes skyddas via `ADMIN_TOKEN` (miljövariabel)
- Cookie-baserad autentisering (httpOnly, secure i production)
- Token-validering stödjer cookies, Authorization header och query params (bakåtkompatibilitet)
- Admin auth helper: `lib/admin-auth.ts`
- React hook: `app/hooks/useAdminAuth.ts` för enkel integration
- Auth endpoint: `/api/admin/auth` (POST för login, DELETE för logout, GET för status)

### Webhook-säkerhet
- HMAC-SHA256 signaturverifiering
- Timestamp-validering (max 10 minuter gammal)
- Duplicate event detection
- Replay attack protection

---

## 📡 API Endpoints

### Publika Routes
- `GET /api/winner` - Hämta nuvarande vinnare
- `GET /api/leaderboard` - Top 20 submissions med win probability

### Autentiserade Routes (Twitch login)
- `POST /api/enter` - Anmäl sig till raffle (kräver Twitch login + follow)
  - Accepterar `demoLink` (valfritt)
  - Förhindrar dubbel-submission
  - Validerar URL format
- `GET /api/user/submission` - Hämta användarens aktiva submission
- `POST /api/twitch/sync` - Synka användares Twitch-data (polling)

### Admin Routes (kräver ADMIN_TOKEN via cookie eller header)
- `POST /api/admin/auth` - Logga in som admin (sätter cookie)
- `DELETE /api/admin/auth` - Logga ut (rensar cookie)
- `GET /api/admin/auth` - Kontrollera autentiseringsstatus
- `GET /api/admin/entries` - Hämta alla entries med search/sort
- `DELETE /api/admin/entries/[id]` - Ta bort en entry
- `GET /api/admin/weight-settings` - Hämta weight settings
- `PUT /api/admin/weight-settings` - Uppdatera weight settings
- `POST /api/pick-winner` - Dra en vinnare (weighted random)
- `POST /api/demo-played` - Markera att demo spelats (återställer cheer bits/gifted subs)
- `POST /api/twitch/update-weights` - Uppdatera alla weights manuellt
- `POST /api/twitch/carry-over` - Carry over weights till nästa stream

### Webhooks
- `POST /api/twitch/webhook` - Twitch EventSub webhook handler
  - `channel.subscribe` - Ny prenumeration
  - `channel.subscription.message` - Resub med cumulative months
  - `channel.subscription.gift` - Donerade subs
  - `channel.cheer` - Bits cheered
  - `channel.follow` - Ny följare

---

## ⚖️ Weight System

### Weight Calculation

Weight settings lagras i databasen (`WeightSettings` model) och kan uppdateras via admin panel.

**Standardvärden (kan ändras via admin panel):**

```typescript
baseWeight = 1.0

// Caps för att förhindra whales
subMonthsWeight = min(subMonths, subMonthsCap) * subMonthsMultiplier  // Default: max 10 * 0.1 = +1.0
resubWeight = min(resubCount, resubCap) * resubMultiplier              // Default: max 5 * 0.2 = +1.0
cheerWeight = min(totalCheerBits / cheerBitsDivisor, cheerBitsCap) // Default: max 5.0
donationWeight = min(totalDonations / donationsDivisor, donationsCap) // Default: max 5.0
giftedSubsWeight = min(totalGiftedSubs * giftedSubsMultiplier, giftedSubsCap) // Default: max 5.0

totalWeight = baseWeight + subMonthsWeight + resubWeight + 
              cheerWeight + donationWeight + giftedSubsWeight + 
              carryOverWeight
```

### Weight Settings Management

- **Storage**: Databas (Prisma `WeightSettings` model)
- **Helper**: `lib/weight-settings.ts`
  - `getWeightSettings()` - Hämtar settings (med 1 min cache)
  - `updateWeightSettings()` - Uppdaterar settings
  - `calculateUserWeight()` - Centraliserad weight calculation
- **Admin UI**: `/demo-admin` → Weights tab (editerbar form)
- **API**: `PUT /api/admin/weight-settings` för att uppdatera

### Anti-Whale Mekanismer

1. **Caps på weights:**
   - Subscription months: Max 10 månader räknas
   - Resubs: Max 5 resubs räknas
   - Alla andra weights har max-värden

2. **Återställning vid vinst:**
   - När vinnare väljs → `totalCheerBits = 0`, `totalGiftedSubs = 0`
   - Förhindrar att samma person vinner konstant

3. **Carry-over weight:**
   - Non-winners får 50% av sin weight som carry-over till nästa stream
   - Ger andra chans till dem som inte vann tidigare

---

## 🔄 Data Flow

### Användare loggar in
1. OAuth callback → `lib/auth.ts` → `updateUserTwitchData()`
2. Hämtar från Twitch API:
   - User info (via user token)
   - Follow status (via broadcaster token)
   - Subscription info (via broadcaster token)
3. Sparar i databas
4. Blockar login om inte följare

### Realtidsuppdateringar
1. **Polling**: Frontend pollar `/api/twitch/sync` var 10:e sekund
2. **Webhooks**: Twitch skickar events → `/api/twitch/webhook`
   - Verifierar signatur och timestamp
   - Kontrollerar duplicater
   - Uppdaterar användardata
   - Räkna om weights

### Winner Selection
1. Admin anropar `/api/pick-winner`
2. Hämtar alla entries (non-winners)
3. Weighted random selection baserat på `totalWeight`
4. Markerar vinnare i databas
5. **Återställer** `totalCheerBits` och `totalGiftedSubs` för vinnaren

---

## 🎨 Frontend

### Sidor
- `/` - Landing page med raffle form och leaderboard
- `/demo-portal` - User dashboard med:
  - Demo submission form (med link)
  - My Status card (weight breakdown)
  - Top 20 Leaderboard (real-time)
  - Weight parameters table
  - Submissions status banner
- `/demo-admin` - Admin panel med tabs:
  - **Users tab**: Alla entries med search, sort, remove funktion
  - **Weights tab**: Redigerbar weight settings form
  - **Raffle tab**: Draw winner button med animation + Top 20 för stream
- `/admin` - Enkel admin-sida för att dra vinnare (legacy)

### Komponenter

**User Components:**
- `TwitchLogin.tsx` - Twitch authentication och user stats
- `DemoSubmissionForm.tsx` - Form för att skicka in demo link
- `MyStatusCard.tsx` - Visar user's total weight och breakdown
- `TopList.tsx` - Leaderboard lista (används på båda sidor)
- `WeightTable.tsx` - Tabell över weight parameters

**Admin Components:**
- `AdminUserTable.tsx` - Tabell med alla entries, search, sort, remove
- `AdminWeightsForm.tsx` - Redigerbar form för weight settings
- `RaffleWheel.tsx` - Animerad raffle drawing med scroll-effekt

**Hooks:**
- `app/hooks/useAdminAuth.ts` - Hook för admin authentication (cookies)

---

## 🔧 Konfiguration

### Miljövariabler
```env
# Twitch OAuth
TWITCH_CLIENT_ID=
TWITCH_CLIENT_SECRET=
TWITCH_BROADCASTER_ID=

# Twitch Webhooks
TWITCH_WEBHOOK_SECRET=

# NextAuth
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# Database
DATABASE_URL=

# Admin
ADMIN_TOKEN=
```

### Twitch Scopes
- User token: `user:read:email`
- Broadcaster token (automatisk): `channel:read:subscriptions`, `moderator:read:followers`, `bits:read`

---

## 🚀 Deployment

### Vercel (Rekommenderat)
1. Push till GitHub
2. Importera i Vercel
3. Lägg till miljövariabler
4. Deploy

### Database
- PostgreSQL (via Prisma Data Platform eller egen instans)
- Migrationer körs automatiskt vid deployment

---

## 📈 Key Features

### ✅ Implementerat
- Twitch OAuth med obligatorisk channel follow
- Automatisk weight-beräkning baserad på Twitch-engagement
- Realtidsuppdateringar via webhooks + polling
- Weighted winner selection
- Anti-whale system (caps + återställning)
- Duplicate event protection
- Security best practices (HMAC, timestamps)
- Leaderboard med live win probability
- Status-indikator för submissions
- Demo submission med link support
- Cookie-baserad admin authentication
- Dynamiska weight settings (databaslagrade)
- Full admin panel med user management och weight configuration
- User dashboard med weight breakdown och live stats

### 🔒 Säkerhet
- HMAC-SHA256 webhook-signaturer
- Timestamp-validering (max 10 min)
- Replay attack protection
- Admin-token för skyddade endpoints (cookie-baserad, httpOnly)
- Input-validering
- SQL injection protection (Prisma)
- Cookie security: httpOnly, secure (production), SameSite: lax

---

## 📚 Dokumentation

- `README.md` - Projektöversikt
- `docs/setup/TWITCH_SETUP.md` - Detaljerad Twitch setup-guide
- `docs/architecture/ARCHITECTURE.md` - Denna fil

---

## 🎯 Användningsfall

### För Streamers
1. Visa startsidan i OBS/stream overlay
2. Tittare ser live leaderboard med win probability
3. Använd `/api/pick-winner` (admin) för att dra vinnare
4. Systemet återställer automatiskt vinnarens cheer bits/gifted subs

### För Tittare
1. Logga in med Twitch (måste följa kanalen)
2. Anmäl sig till raffle
3. Se sin win probability i leaderboard
4. Weight ökar automatiskt baserat på subs/bits/donations

---

## 🔄 Workflow

```
Stream Start
  ↓
Användare anmäler sig (måste följa)
  ↓
Realtidsuppdateringar (webhooks + polling)
  ↓
Weights uppdateras automatiskt
  ↓
Admin drar vinnare
  ↓
Vinnarens cheer bits/gifted subs återställs
  ↓
Non-winners får carry-over weight
  ↓
Nästa stream (ny chans)
```

---

## 🛡️ Best Practices Implementerade

1. **Official Twitch API endpoints** - Använder dokumenterade endpoints
2. **EventSub compliance** - Följer Twitch's EventSub-dokumentation
3. **Error handling** - Omfattande felhantering i alla API-routes
4. **Type safety** - TypeScript överallt
5. **Database indexing** - Indexerade fält för prestanda
6. **Caching** - Broadcaster token caches
7. **Security** - Timing-safe comparisons, input validation
8. **Performance** - Optimized queries, batch operations

---

## 📦 Deployment Considerations

- Next.js är optimerat för Vercel
- Prisma Client genereras automatiskt (`postinstall` script)
- Environment variables måste sättas i deployment platform
- Twitch webhooks måste peka på public URL (ngrok för local dev)
- Database måste vara tillgänglig från deployment platform

