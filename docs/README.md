# Dokumentation - Demo Raffle v1

Denna mapp innehåller all projekt-dokumentation organiserad i kategorier.

## 📁 Struktur

### 📘 Setup Guides (`setup/`)
Steg-för-steg guides för att sätta upp olika delar av applikationen:

- **[TWITCH_SETUP.md](./setup/TWITCH_SETUP.md)** - Konfigurera Twitch OAuth och EventSub webhooks
- **[SUPABASE_SETUP.md](./setup/SUPABASE_SETUP.md)** - Komplett guide för Supabase PostgreSQL setup
- **[SUPABASE_APP_VERIFICATION.md](./setup/SUPABASE_APP_VERIFICATION.md)** - Verifiering att Supabase setup är korrekt för denna app

### 🚀 Deployment (`deployment/`)
Guides för att deploya applikationen till produktion:

- **[DEPLOYMENT.md](./deployment/DEPLOYMENT.md)** - Komplett deployment guide (Vercel, environment variables, etc.)
- **[DATABASE_RECOMMENDATIONS.md](./deployment/DATABASE_RECOMMENDATIONS.md)** - Jämförelse och rekommendationer för PostgreSQL-databaser

### 🏗️ Architecture (`architecture/`)
Teknisk dokumentation om appens design och struktur:

- **[ARCHITECTURE.md](./architecture/ARCHITECTURE.md)** - Komplett teknisk arkitektur och design (single source of truth)
- **[AUDIT_SUMMARY.md](./architecture/AUDIT_SUMMARY.md)** - Audit-rapport och fixes som applicerats

### 📚 Reference (`reference/`)
Referensdokumentation och version-specifik information:

- **[DOCUMENTATION_VERSIONS.md](./reference/DOCUMENTATION_VERSIONS.md)** - Version-specifik dokumentation och vanliga fallgropar
- **[VERSION_FIXES_2025-01-29.md](./reference/VERSION_FIXES_2025-01-29.md)** - Specifika fixes för version-kompatibilitet

---

## 🎯 Snabbstart

### För nya utvecklare:
1. Läs [ARCHITECTURE.md](./architecture/ARCHITECTURE.md) för att förstå systemet
2. Följ [TWITCH_SETUP.md](./setup/TWITCH_SETUP.md) för Twitch-konfiguration
3. Följ [SUPABASE_SETUP.md](./setup/SUPABASE_SETUP.md) för databas-setup
4. Se [DEPLOYMENT.md](./deployment/DEPLOYMENT.md) för deployment

### För deployment:
1. Se [DATABASE_RECOMMENDATIONS.md](./deployment/DATABASE_RECOMMENDATIONS.md) för databasval
2. Följ [DEPLOYMENT.md](./deployment/DEPLOYMENT.md) steg-för-steg
3. Verifiera med [SUPABASE_APP_VERIFICATION.md](./setup/SUPABASE_APP_VERIFICATION.md)

### För troubleshooting:
1. Kolla [DOCUMENTATION_VERSIONS.md](./reference/DOCUMENTATION_VERSIONS.md) för version-specifika problem
2. Se [VERSION_FIXES_2025-01-29.md](./reference/VERSION_FIXES_2025-01-29.md) för kända fixes
3. Läs [AUDIT_SUMMARY.md](./architecture/AUDIT_SUMMARY.md) för kända issues

---

## 📖 Huvuddokumentation

För översikt och snabbstart, se [README.md](../README.md) i projektroten.

