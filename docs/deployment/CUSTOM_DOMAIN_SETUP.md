# Custom Domain Setup - Bossfight Music

Guide för att deploya appen på `demo-portal.bossfightmusic.com` (subdomain) via Vercel.

## 🎯 Varför Subdomain?

**Problem med `/demo-portal` path på huvuddomänen:**
- Squarespace är en webbplatsbyggare, inte en hosting-plattform för Next.js
- Squarespace stödjer INTE reverse proxy eller custom server-side apps
- För att ha `/demo-portal` som path krävs reverse proxy, vilket Squarespace inte stödjer

**Lösning: Subdomain**
- ✅ Mycket enklare setup
- ✅ Standard-praxis för att hosta olika applikationer
- ✅ Fungerar perfekt med Vercel
- ✅ Du kan fortfarande jobba lokalt och pusha till GitHub

---

## 📋 Steg-för-Steg Guide

### Steg 1: Deploy på Vercel (Först)

1. **Push till GitHub** (om inte redan gjort):
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Skapa Vercel-konto**:
   - Gå till https://vercel.com
   - Logga in med GitHub

3. **Importera Projekt**:
   - Klicka "Add New Project"
   - Välj ditt GitHub-repo
   - Vercel kommer auto-detektera Next.js

4. **Konfigurera Environment Variables**:
   - Klicka "Environment Variables" i projekt-inställningarna
   - Lägg till ALLA variabler (se lista nedan)
   - **Viktigt**: Välj "Production", "Preview", och "Development"
   
   **Variabler att lägga till:**
   ```env
   DATABASE_URL="postgres://postgres.sbckhsmaxmbppywayqjc:K1ngen_I_B1ngen93@aws-1-eu-west-1.pooler.supabase.com:6543/postgres"
   DIRECT_URL="postgresql://postgres:K1ngen_I_B1ngen93@db.sbckhsmaxmbppywayqjc.supabase.co:5432/postgres"
   TWITCH_CLIENT_ID="ditt_twitch_client_id"
   TWITCH_CLIENT_SECRET="ditt_twitch_client_secret"
   TWITCH_BROADCASTER_ID="ditt_twitch_user_id"
   TWITCH_WEBHOOK_SECRET="ditt_webhook_secret"
   NEXTAUTH_URL="https://demo-portal.bossfightmusic.com"  # ⚠️ Uppdatera efter DNS setup
   NEXTAUTH_SECRET="ditt_nextauth_secret"
   ADMIN_TOKEN="ditt_admin_token"
   ```

5. **Deploy**:
   - Klicka "Deploy"
   - Vänta på build (2-5 minuter)
   - Du får en URL som `https://demo-raffle-v1.vercel.app` (temporär)

---

### Steg 2: Konfigurera Subdomain i Squarespace

1. **Logga in på Squarespace**:
   - Gå till din Squarespace Dashboard
   - Välj din site (bossfightmusic.com)

2. **Gå till DNS Settings**:
   - Settings → Domains → bossfightmusic.com
   - Klicka "DNS Settings" eller "Advanced DNS"

3. **Lägg till CNAME Record**:
   - Klicka "Add Record"
   - **Type**: CNAME
   - **Host**: `demo-portal` (eller `demo` om du föredrar)
   - **Data**: `cname.vercel-dns.com` (Vercel kommer ge dig exakt värde)
   - **TTL**: 3600 (standard)
   - Spara

**OBS**: Vercel kommer ge dig exakt CNAME-värde när du lägger till domänen (se nästa steg).

---

### Steg 3: Lägg till Custom Domain i Vercel

1. **I Vercel Dashboard**:
   - Gå till ditt projekt → Settings → Domains
   - Klicka "Add Domain"

2. **Lägg till subdomain**:
   - Skriv: `demo-portal.bossfightmusic.com`
   - Klicka "Add"

3. **Följ DNS-instruktionerna**:
   - Vercel kommer visa exakt CNAME-värde du behöver
   - Exempel: `cname.vercel-dns.com` eller liknande
   - **Kopiera detta värde**

4. **Uppdatera DNS i Squarespace**:
   - Gå tillbaka till Squarespace DNS Settings
   - Uppdatera CNAME-record med exakt värde från Vercel
   - Spara

5. **Vänta på DNS propagation**:
   - Det kan ta 5-60 minuter
   - Vercel kommer automatiskt konfigurera SSL-certifikat

---

### Steg 4: Uppdatera Environment Variables

När DNS är konfigurerad och subdomain fungerar:

1. **I Vercel Dashboard**:
   - Gå till Settings → Environment Variables
   - Hitta `NEXTAUTH_URL`
   - Uppdatera till: `https://demo-portal.bossfightmusic.com`
   - Spara

2. **Kör ny deployment**:
   - Gå till Deployments
   - Klicka "Redeploy" på senaste deployment
   - Eller pusha en ny commit till GitHub

---

### Steg 5: Uppdatera Twitch OAuth

1. **Gå till Twitch Developer Console**:
   - https://dev.twitch.tv/console/apps
   - Välj din app

2. **Uppdatera OAuth Redirect URLs**:
   - Lägg till: `https://demo-portal.bossfightmusic.com/api/auth/callback/twitch`
   - Ta bort gamla localhost-URL:en (eller behåll den för lokal utveckling)
   - Spara

---

### Steg 6: Verifiera

1. **Öppna subdomain**:
   - Gå till https://demo-portal.bossfightmusic.com
   - Sidan ska ladda korrekt

2. **Testa Twitch Login**:
   - Klicka "Logga in med Twitch"
   - Verifiera att redirect fungerar

3. **Health Endpoints**:
   ```
   https://demo-portal.bossfightmusic.com/api/health/app
   https://demo-portal.bossfightmusic.com/api/health/db
   ```
   Båda ska returnera `{ ok: true }`

---

## 🔄 Arbetsflöde (Lokal Utveckling → Production)

### Jobba Lokalt

1. **Kör lokalt**:
   ```bash
   npm run dev
   ```
   - Appen körs på http://localhost:3000
   - Du kan testa alla features lokalt

2. **När du är klar**:
   ```bash
   git add .
   git commit -m "Beskrivning av ändringar"
   git push origin main
   ```

3. **Vercel deployar automatiskt**:
   - Vercel detekterar push till `main` branch
   - Bygger och deployar automatiskt
   - Din subdomain uppdateras automatiskt

### Preview Deployments

- När du pushar till andra branches (t.ex. `feature/new-feature`)
- Vercel skapar automatiskt preview-URLs
- Perfekt för att testa innan production

---

## 🎯 Resultat

Efter setup:

- **Production URL**: https://demo-portal.bossfightmusic.com
- **Lokal utveckling**: http://localhost:3000
- **Auto-deploy**: Push till GitHub → Vercel deployar automatiskt
- **SSL**: Automatiskt via Vercel (gratis)

---

## ⚠️ Troubleshooting

### DNS fungerar inte

**Problem**: Subdomain laddar inte eller visar fel

**Lösningar**:
1. Kontrollera att CNAME-record är korrekt i Squarespace
2. Vänta längre (DNS kan ta upp till 24 timmar, men oftast 5-60 min)
3. Använd DNS checker: https://dnschecker.org
4. Kontrollera att CNAME pekar på rätt Vercel-värde

### SSL-certifikat fungerar inte

**Problem**: "Not Secure" i webbläsaren

**Lösningar**:
1. Vänta - Vercel konfigurerar SSL automatiskt (kan ta 5-10 min)
2. Kontrollera att DNS är korrekt konfigurerad
3. I Vercel Dashboard → Domains, kontrollera status

### NextAuth redirect fungerar inte

**Problem**: Twitch login redirectar till fel URL

**Lösningar**:
1. Kontrollera att `NEXTAUTH_URL` i Vercel är `https://demo-portal.bossfightmusic.com`
2. Kontrollera att Twitch OAuth Redirect URL är korrekt
3. Kör ny deployment efter att ha ändrat environment variables

---

## 📝 Sammanfattning

**Vad vi gjorde:**
1. ✅ Deployade appen på Vercel
2. ✅ Skapade subdomain `demo-portal.bossfightmusic.com`
3. ✅ Konfigurerade DNS i Squarespace
4. ✅ Uppdaterade environment variables
5. ✅ Uppdaterade Twitch OAuth

**Resultat:**
- Appen är live på https://demo-portal.bossfightmusic.com
- Du kan fortfarande jobba lokalt på localhost:3000
- Auto-deploy när du pushar till GitHub
- SSL-certifikat automatiskt

---

## 🎉 Klar!

Din app är nu live på din egen subdomain! Du kan fortsätta jobba lokalt och pusha till GitHub för att uppdatera production.

