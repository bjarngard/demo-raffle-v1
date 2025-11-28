# Fix Vercel Auto-Deploy från GitHub

Om Vercel inte automatiskt deployar när du pushar till GitHub, följ dessa steg:

## 🔍 Steg 1: Kontrollera Git Integration

1. **Gå till Vercel Dashboard**:
   - https://vercel.com/dashboard
   - Välj ditt projekt (`demo-raffle-v1`)

2. **Gå till Settings → Git**:
   - Klicka på "Settings" i projekt-menyn
   - Klicka på "Git" tab

3. **Kontrollera följande**:
   - ✅ **Connected Git Repository**: Ska visa `bjarngard/demo-raffle-v1`
   - ✅ **Production Branch**: Ska vara `main`
   - ✅ **Auto-deploy**: Ska vara aktiverat (ON)

## 🔧 Steg 2: Om Git Repository INTE är kopplat

Om du ser "No Git Repository Connected":

1. **Klicka "Connect Git Repository"**
2. **Välj GitHub** (om inte redan valt)
3. **Välj ditt repo**: `bjarngard/demo-raffle-v1`
4. **Klicka "Import"**
5. **Konfigurera**:
   - **Production Branch**: `main`
   - **Root Directory**: `./` (standard)
   - **Build Command**: `npm run build` (standard)
   - **Output Directory**: `.next` (standard)
6. **Lägg till Environment Variables** (om inte redan gjort)
7. **Klicka "Deploy"**

## 🔧 Steg 3: Om Auto-Deploy är avstängt

Om "Auto-deploy" är OFF:

1. **Aktivera Auto-deploy**:
   - Toggle "Auto-deploy" till ON
   - Spara ändringar

2. **Kontrollera Production Branch**:
   - Ska vara `main`
   - Om det är något annat, ändra till `main`

## 🔧 Steg 4: Om GitHub Webhook saknas

Om auto-deploy fortfarande inte fungerar:

1. **Kontrollera GitHub Webhook**:
   - Gå till GitHub → ditt repo → Settings → Webhooks
   - Sök efter Vercel webhook
   - Ska finnas en webhook med URL som börjar med `https://api.vercel.com/...`

2. **Om webhook saknas**:
   - Gå tillbaka till Vercel Dashboard → Settings → Git
   - Klicka "Disconnect" (om det finns)
   - Klicka "Connect Git Repository" igen
   - Välj GitHub → ditt repo → Import
   - Detta skapar webhook automatiskt

## ✅ Steg 5: Testa Auto-Deploy

Efter att ha fixat inställningarna:

1. **Gör en liten ändring**:
   ```bash
   echo "# Test" >> README.md
   git add README.md
   git commit -m "Test auto-deploy"
   git push origin main
   ```

2. **Kontrollera Vercel Dashboard**:
   - Gå till Deployments
   - Du ska se en ny deployment starta automatiskt inom 10-30 sekunder
   - Status ska vara "Building..." → "Ready"

## ⚠️ Vanliga Problem

### Problem: "No Git Repository Connected"
**Lösning**: Följ Steg 2 ovan för att koppla GitHub repo.

### Problem: Auto-deploy är OFF
**Lösning**: Följ Steg 3 ovan för att aktivera auto-deploy.

### Problem: Production Branch är fel
**Lösning**: Ändra till `main` i Settings → Git → Production Branch.

### Problem: Webhook fungerar inte
**Lösning**: Följ Steg 4 ovan för att återskapa webhook.

## 📝 Checklista

- [ ] Git Repository är kopplat till `bjarngard/demo-raffle-v1`
- [ ] Production Branch är `main`
- [ ] Auto-deploy är aktiverat (ON)
- [ ] GitHub webhook finns (kontrollera i GitHub → Settings → Webhooks)
- [ ] Testat med en push till `main` branch

## 🎯 Efter Fix

När auto-deploy fungerar:
- Varje push till `main` branch → Production deployment automatiskt
- Varje push till andra branches → Preview deployment automatiskt
- Du behöver inte längre deploya manuellt!

