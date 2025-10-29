# Demo Raffle v1

En webbapplikation för att hantera utlottningar byggd med Next.js, Prisma och PostgreSQL.

## Funktioner

- ✅ Användare kan anmäla sig via ett formulär på startsidan
- ✅ Admin kan dra en slumpmässig vinnare via admin-panelen
- ✅ Automatisk vinnarvisning när en vinnare har utsetts
- ✅ Validering och hantering av dubbla e-postregistreringar
- ✅ Säker admin-autentisering via token

## Teknikstack

- **Next.js 16** - React-ramverk med App Router
- **Prisma** - ORM för databashantering
- **PostgreSQL** - Databas (via Prisma Data Platform eller egen instans)
- **TypeScript** - Typsäkerhet
- **Tailwind CSS** - Styling

## Kom igång

### 1. Installation

```bash
npm install
```

### 2. Konfigurera databas

Du behöver skapa en `.env`-fil i projektroten med följande innehåll:

```env
DATABASE_URL="postgresql://user:password@host:port/database"
ADMIN_TOKEN="ditt-hemliga-admin-token"
```

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

- `POST /api/enter` - Registrera en ny deltagare
- `POST /api/pick-winner` - Dra en vinnare (kräver admin-token)
- `GET /api/winner` - Hämta information om vinnaren

## Driftsättning på Vercel

1. Pusha koden till GitHub
2. Importera projektet i Vercel
3. Lägg till miljövariabler i Vercel Project Settings:
   - `DATABASE_URL` - Din databasanslutningssträng
   - `ADMIN_TOKEN` - Ditt hemliga admin-token
4. Deploya projektet

Vercel kommer automatiskt köra `prisma generate` vid varje deployment.

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
