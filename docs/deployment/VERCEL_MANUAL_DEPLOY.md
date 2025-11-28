# Vercel Manual Deployment Guide

Om auto-deploy inte fungerar, kan du deploya manuellt via Vercel CLI eller Dashboard.

## 🚀 Metod 1: Vercel Dashboard (Enklast)

1. **Gå till Vercel Dashboard**:
   - https://vercel.com/dashboard
   - Välj ditt projekt

2. **Gå till Deployments**:
   - Klicka på "Deployments" i menyn

3. **Redeploy senaste deployment**:
   - Hitta senaste deployment (överst)
   - Klicka på "..." (tre punkter)
   - Välj "Redeploy"
   - Bekräfta

4. **Eller deploya från specifik commit**:
   - Klicka "Create Deployment"
   - Välj branch: `main`
   - Välj commit (eller låt den välja senaste)
   - Klicka "Deploy"

## 🚀 Metod 2: Vercel CLI (Rekommenderat för frekventa uppdateringar)

### Installera Vercel CLI

```bash
npm i -g vercel
```

### Login

```bash
vercel login
```

### Deploy till Production

```bash
# Från projektroten
vercel --prod
```

Detta deployar direkt till production utan att vänta på GitHub push.

### Alternativ: Deploy från specifik branch

```bash
vercel --prod --branch main
```

## 🔄 Workflow med Manual Deploy

### När du gör ändringar:

1. **Commit och push till GitHub**:
   ```bash
   git add .
   git commit -m "Beskrivning av ändringar"
   git push origin main
   ```

2. **Deploy manuellt via Vercel CLI**:
   ```bash
   vercel --prod
   ```

Eller via Dashboard:
- Deployments → Create Deployment → Välj commit → Deploy

## 💡 Tips

- **Vercel CLI är snabbast**: `vercel --prod` tar bara några sekunder
- **Dashboard är enklast**: Inga kommandon, bara klicka
- **Auto-deploy är bäst**: Men om det inte fungerar, manual deploy fungerar perfekt

## ⚠️ OBS

Om du använder manual deploy, kom ihåg att:
- Environment variables uppdateras automatiskt (om du ändrar dem i Dashboard)
- Du behöver inte göra något extra - bara deploya
- Alla ändringar från GitHub är tillgängliga att deploya

