#  Snabbstart: Deploy till demo-portal.bossfightmusic.com

## Steg 1: Push till GitHub
`ash
git add .
git commit -m "Ready for production deployment"
git push origin main
`

## Steg 2: Vercel Setup
1. Gå till https://vercel.com och logga in med GitHub
2. Klicka "Add New Project"
3. Välj ditt GitHub-repo
4. Vercel auto-detekterar Next.js 

## Steg 3: Environment Variables i Vercel
Lägg till dessa i Vercel Dashboard  Settings  Environment Variables:

- DATABASE_URL (från Supabase - Transaction mode, port 6543)
- DIRECT_URL (från Supabase - Direct connection, port 5432)
- TWITCH_CLIENT_ID
- TWITCH_CLIENT_SECRET
- TWITCH_BROADCASTER_ID
- TWITCH_WEBHOOK_SECRET
- NEXTAUTH_URL="https://demo-portal.bossfightmusic.com"
- NEXTAUTH_SECRET
- ADMIN_TOKEN

**Viktigt**: Välj "Production", "Preview", och "Development" för varje variabel!

## Steg 4: Deploy
Klicka "Deploy" och vänta 2-5 minuter.

## Steg 5: Custom Domain
1. I Vercel  Settings  Domains  "Add Domain"
2. Skriv: demo-portal.bossfightmusic.com
3. Vercel ger dig CNAME-värde
4. Lägg till CNAME i Squarespace DNS (Settings  Domains  DNS Settings)
5. Vänta 5-60 minuter på DNS propagation

## Steg 6: Uppdatera Twitch OAuth
1. Gå till https://dev.twitch.tv/console/apps
2. Lägg till: https://demo-portal.bossfightmusic.com/api/auth/callback/twitch
3. Spara

##  Klar!
Din app är live på https://demo-portal.bossfightmusic.com
