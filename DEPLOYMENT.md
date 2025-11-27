# Deployment Guide - Demo Raffle v1

Komplett guide för att deploya appen från lokal utveckling till produktion.

## 📋 Förberedelse Checklista

Innan du börjar, se till att du har:
- [ ] GitHub-repo skapat och koden pushat
- [ ] PostgreSQL-databas (lokal eller moln-tjänst)
- [ ] Twitch Developer Account med app registrerad
- [ ] Alla miljövariabler klara

---

## 🗄️ Steg 1: Databas Setup

**📖 Se [DATABASE_RECOMMENDATIONS.md](./DATABASE_RECOMMENDATIONS.md) för detaljerad jämförelse av alla alternativ.**

### ⭐ Rekommenderat: Supabase (Gratis, Enkelt)

1. Gå till https://supabase.com
2. Skapa konto (gratis)
3. Klicka "New Project"
4. Fyll i:
   - **Name**: `demo-raffle-db`
   - **Database Password**: Skapa starkt lösenord (spara det!)
   - **Region**: Närmast dig
5. Vänta 2 minuter (projekt skapas)
6. Gå till **Project Settings** → **Database**
7. Scrolla ner till "Connection string"
8. Välj **"URI"** tab
9. Kopiera connection string och ersätt `[YOUR-PASSWORD]` med ditt lösenord

**Format**: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`

### Alternativ: Railway (För produktion)

1. Gå till https://railway.app
2. Skapa konto (gratis med $5 credit)
3. Klicka "New Project" → "Provision PostgreSQL"
4. Vänta 1 minut
5. Klicka på PostgreSQL-servern → "Variables" tab
6. Kopiera `DATABASE_URL` (automatiskt formaterad)

### Andra Alternativ

- **Neon**: https://neon.tech (modern, serverless, gratis tier)
- **Render**: https://render.com (90 dagar gratis trial)
- **Vercel Postgres**: Om du använder Vercel (integrerat)

Se `DATABASE_RECOMMENDATIONS.md` för fullständig jämförelse.

### Kör Migrations

När du har `DATABASE_URL`, kör migrations lokalt först för att testa:

```bash
npx prisma migrate deploy
```

**OBS**: Vid första deployment kommer Vercel köra migrations automatiskt om du har `postinstall` script (vilket du har).

---

## 🔐 Steg 2: Environment Variables

Du behöver följande miljövariabler. Förbered dem innan deployment:

### Nödvändiga Variabler

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# Admin
ADMIN_TOKEN="generera-ett-långt-hemligt-token-här"

# Twitch OAuth
TWITCH_CLIENT_ID="ditt_twitch_client_id"
TWITCH_CLIENT_SECRET="ditt_twitch_client_secret"
TWITCH_BROADCASTER_ID="ditt_twitch_user_id"

# Twitch Webhooks
TWITCH_WEBHOOK_SECRET="generera-ett-hemligt-token-här"

# NextAuth
NEXTAUTH_URL="https://ditt-projekt.vercel.app"
NEXTAUTH_SECRET="generera-ett-långt-hemligt-token-här"
```

### Generera Secrets

**ADMIN_TOKEN:**
```bash
openssl rand -base64 32
```

**TWITCH_WEBHOOK_SECRET:**
```bash
openssl rand -base64 32
```

**NEXTAUTH_SECRET:**
```bash
openssl rand -base64 32
```

Eller använd online-generator: https://generate-secret.vercel.app/32

---

## 🎮 Steg 3: Twitch Configuration

### 1. Uppdatera Twitch App Redirect URLs

1. Gå till https://dev.twitch.tv/console/apps
2. Välj din app
3. Lägg till produktion URL i **OAuth Redirect URLs**:
   ```
   https://ditt-projekt.vercel.app/api/auth/callback/twitch
   ```
4. Spara

### 2. Konfigurera EventSub Webhooks

**VIKTIGT**: Efter deployment måste du registrera EventSub subscriptions via Twitch API.

Webhook endpoint:
```
https://ditt-projekt.vercel.app/api/twitch/webhook
```

Använd Twitch CLI eller API för att skapa subscriptions:

```bash
# Installera Twitch CLI
# Se: https://dev.twitch.tv/docs/cli

twitch api post eventsub/subscriptions -b '{
  "type": "channel.subscribe",
  "version": "1",
  "condition": {
    "broadcaster_user_id": "DIN_BROADCASTER_ID"
  },
  "transport": {
    "method": "webhook",
    "callback": "https://ditt-projekt.vercel.app/api/twitch/webhook",
    "secret": "DIN_TWITCH_WEBHOOK_SECRET"
  }
}'
```

**EventSub Types du behöver:**
- `channel.subscribe` (subscriptions)
- `channel.subscription.message` (resubs)
- `channel.cheer` (bits)
- `channel.subscription.gift` (gifted subs)

---

## 🚀 Steg 4: Deploy till Vercel

### Metod 1: Via Vercel Dashboard (Rekommenderat)

1. **Push till GitHub**
   ```bash
   git add .
   git commit -m "Ready for production"
   git push origin main
   ```

2. **Skapa Vercel-konto**
   - Gå till https://vercel.com
   - Logga in med GitHub

3. **Importera Projekt**
   - Klicka "Add New Project"
   - Välj ditt GitHub-repo
   - Vercel kommer auto-detektera Next.js

4. **Konfigurera Projekt**
   - **Framework Preset**: Next.js (auto-detekterat)
   - **Root Directory**: `./` (standard)
   - **Build Command**: `npm run build` (standard)
   - **Output Directory**: `.next` (standard)
   - **Install Command**: `npm install` (standard)

5. **Environment Variables**
   Lägg till ALLA variabler från Steg 2:
   - Klicka "Environment Variables"
   - Lägg till varje variabel (se lista ovan)
   - **Viktigt**: Välj "Production", "Preview", och "Development"

6. **Deploy**
   - Klicka "Deploy"
   - Vänta på build att slutföras (2-5 minuter)

### Metod 2: Via Vercel CLI

```bash
# Installera Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Följ instruktionerna och lägg till environment variables när du blir tillfrågad
```

---

## ✅ Steg 5: Post-Deployment Checklist

### Verifiera Deployment

1. **Öppna din Vercel URL**
   - Kontrollera att sidan laddas korrekt
   - Testa att logga in med Twitch

2. **Health Endpoints**
   ```
   https://ditt-projekt.vercel.app/api/health/app
   https://ditt-projekt.vercel.app/api/health/db
   ```
   Båda ska returnera `{ ok: true }`

3. **Database Connection**
   - Öppna Vercel Functions Logs
   - Kontrollera att inga database connection errors finns
   - Om det finns fel, dubbelkolla `DATABASE_URL`

4. **Twitch OAuth**
   - Testa att logga in via Twitch
   - Verifiera att redirect fungerar efter inloggning

5. **Prisma Migrations**
   - Om databasen är tom, kör migrations manuellt:
   ```bash
   npx prisma migrate deploy --schema=./prisma/schema.prisma
   ```
   Eller använd Vercel CLI:
   ```bash
   vercel env pull
   npx prisma migrate deploy
   ```

### Konfigurera Custom Domain (Valfritt)

1. I Vercel Dashboard, gå till Project Settings > Domains
2. Lägg till din domän
3. Följ DNS-instruktionerna
4. **Uppdatera**:
   - `NEXTAUTH_URL` i Vercel environment variables
   - Twitch OAuth Redirect URLs

---

## 🔧 Steg 6: Twitch EventSub Webhooks Setup

Efter deployment måste du registrera EventSub subscriptions för att få real-time updates.

### Metod 1: Twitch CLI (Enklast)

```bash
# Installera Twitch CLI
# Windows: choco install twitch-cli
# Mac: brew install twitchdev/tap/twitch-cli
# Linux: Se https://github.com/twitchdev/twitch-cli

# Login
twitch configure

# Skapa webhook subscriptions
twitch api post eventsub/subscriptions -b '{
  "type": "channel.subscribe",
  "version": "1",
  "condition": {
    "broadcaster_user_id": "DIN_BROADCASTER_ID"
  },
  "transport": {
    "method": "webhook",
    "callback": "https://ditt-projekt.vercel.app/api/twitch/webhook",
    "secret": "DIN_TWITCH_WEBHOOK_SECRET"
  }
}'
```

### Metod 2: Via Twitch API

Använd Postman eller curl för att skapa subscriptions.

**Exempel curl:**
```bash
curl -X POST 'https://api.twitch.tv/helix/eventsub/subscriptions' \
  -H 'Authorization: Bearer DIN_ACCESS_TOKEN' \
  -H 'Client-Id: DIN_CLIENT_ID' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "channel.subscribe",
    "version": "1",
    "condition": {
      "broadcaster_user_id": "DIN_BROADCASTER_ID"
    },
    "transport": {
      "method": "webhook",
      "callback": "https://ditt-projekt.vercel.app/api/twitch/webhook",
      "secret": "DIN_TWITCH_WEBHOOK_SECRET"
    }
  }'
```

**Repeat för alla event types:**
- `channel.subscribe`
- `channel.subscription.message`
- `channel.cheer`
- `channel.subscription.gift`

### Verifiera Webhooks

1. I Twitch Developer Console, gå till EventSub Manager
2. Kontrollera att subscriptions är "Enabled"
3. Testa genom att:
   - Följa kanalen (om du har `channel.follow`)
   - Skicka bits (om du har `channel.cheer`)
   - Subscriba (om du har `channel.subscribe`)

---

## 🐛 Troubleshooting

### Problem: Build fails

**Felet**: Prisma Client not generated
**Lösning**: Kontrollera att `postinstall` script finns i `package.json`:
```json
"postinstall": "prisma generate --no-engine"
```

### Problem: Database connection fails

**Fel**: `Can't reach database server`
**Lösningar**:
1. Kontrollera att `DATABASE_URL` är korrekt formaterad
2. Om du använder Vercel, kontrollera att databasen tillåter connections från Vercel IPs
3. För Supabase/Railway, använd connection pooling URL om tillgängligt

### Problem: NextAuth redirect loop

**Fel**: Infinite redirect efter login
**Lösningar**:
1. Kontrollera att `NEXTAUTH_URL` är korrekt (samma som din Vercel URL)
2. Kontrollera att Twitch OAuth Redirect URL stämmer
3. Se till att `trustHost: true` finns i `lib/auth.ts` (redan finns)

### Problem: Environment variables not working

**Fel**: "Missing environment variables" error
**Lösningar**:
1. I Vercel Dashboard, kontrollera att variablerna är sparade
2. **Viktigt**: Efter att lägga till variabler, kör en ny deployment
3. Verifiera att variabelnamnen är exakt rätt (case-sensitive)

### Problem: Webhooks not receiving events

**Felet**: Events kommer inte in
**Lösningar**:
1. Kontrollera webhook URL är tillgänglig publikt
2. Verifiera `TWITCH_WEBHOOK_SECRET` matchar i både Vercel och Twitch subscription
3. Kolla Vercel Functions Logs för webhook errors
4. Använd Twitch CLI för att testa webhook:
   ```bash
   twitch api get eventsub/subscriptions
   ```

---

## 📊 Monitoring & Logs

### Vercel Logs

1. I Vercel Dashboard → din projekt → Logs
2. Du kan se alla console.log och errors
3. Filtrera på Function eller Edge Function

### Health Checks

Använd dessa endpoints för monitoring:
```
GET /api/health/app
GET /api/health/db
```

### Database Monitoring

- **Prisma Studio** (lokalt): `npx prisma studio`
- **Supabase Dashboard**: Använd Supabase dashboard för data-insikter
- **Railway Dashboard**: Se database metrics och logs

---

## 🔄 Continuous Deployment

Vercel deployar automatiskt när du pusher till:
- **main branch** → Production deployment
- **Other branches** → Preview deployment

### Manuell Deployment

```bash
vercel --prod
```

### Rollback

I Vercel Dashboard:
1. Gå till Deployments
2. Hitta tidigare deployment
3. Klicka "..." → "Promote to Production"

---

## 🔒 Security Checklist

- [ ] `ADMIN_TOKEN` är långt och slumpat (minst 32 tecken)
- [ ] `NEXTAUTH_SECRET` är unikt och hemligt
- [ ] `TWITCH_WEBHOOK_SECRET` är unikt och hemligt
- [ ] `.env` fil är i `.gitignore` (redan gjort)
- [ ] Inga secrets i GitHub commits
- [ ] Database connection string är säker
- [ ] Vercel project är private (om applicerbart)

---

## 📝 Quick Reference

### URLs efter Deployment

```
Production URL:    https://ditt-projekt.vercel.app
NextAuth Callback: https://ditt-projekt.vercel.app/api/auth/callback/twitch
Webhook Endpoint:  https://ditt-projekt.vercel.app/api/twitch/webhook
Admin Panel:       https://ditt-projekt.vercel.app/demo-admin
User Portal:       https://ditt-projekt.vercel.app/demo-portal
```

### När du uppdaterar NEXTAUTH_URL

Efter att ha ändrat `NEXTAUTH_URL` i Vercel:
1. Kör ny deployment
2. Uppdatera Twitch OAuth Redirect URL
3. Testa login igen

---

## 🎉 Klar!

Efter dessa steg bör din app vara live och fungerande. Kontakta support om något inte fungerar!

**Nästa steg**: Testa alla features i produktion och verifiera att Twitch webhooks fungerar korrekt.

