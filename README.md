# Movielist

Gemeinsame Film- und Serienliste für Aurora und Vivica. Läuft als Webseite auf GitHub Pages, die Daten liegen in Firebase, die Suche kommt von TMDB.

## Einrichten

### 1. TMDB (Suche)
1. Konto auf [themoviedb.org](https://www.themoviedb.org) anlegen.
2. Einstellungen → API → API-Schlüssel beantragen (Zweck: privat/persönlich).
3. Den **API-Schlüssel** (v3) in `config.js` bei `TMDB_KEY` eintragen.

### 2. Firebase (Datenbank)
1. In der [Firebase-Konsole](https://console.firebase.google.com) ein neues Projekt anlegen, z. B. `movielist`.
2. Build → Realtime Database → Datenbank erstellen (Standort Europa).
3. Unter „Regeln“ den Inhalt von `database.rules.json` einfügen und veröffentlichen.
4. Projekteinstellungen → Allgemein → „Deine Apps“ → Web-App hinzufügen (`</>`), die angezeigte Config in `config.js` bei `FIREBASE_CONFIG` eintragen.

### 3. GitHub Pages
Repo → Settings → Pages → Source: „Deploy from a branch“, Branch `main`, Ordner `/ (root)`.
Danach ist die App unter `https://auroravorwerk.github.io/movielist/` erreichbar.

Auf dem iPhone: in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

## Regeln in der App
- **Watch List:** alles, was nur eine von beiden bewertet hat.
- **Rewatchable:** alles, bei dem mindestens eine den Rewatch-Haken gesetzt hat.
- **Reihen:** Einträge mit gleicher Franchise stehen untereinander, sortiert nach Jahr. Die Franchise kommt bei Filmen automatisch aus TMDB (Filmreihe) und lässt sich im Eintrag ändern, z. B. „MCU“.
