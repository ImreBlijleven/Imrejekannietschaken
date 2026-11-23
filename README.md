# ♞ Schaakcoach

Speel tegen Stockfish, krijg na elke zet een beoordeling en stel vragen aan een AI-coach. De coach mag alleen
praten over wat Stockfish heeft berekend, dus geen verzonnen varianten. De app houdt ook bij welke soorten fouten
je vaak maakt.

## Functies

- **Spelen tegen Stockfish** met een Elo-slider (400–3000), als wit of zwart.
- **Trainingsmodus**: beoordeling na elke zet (Beste / Goed / Onnauwkeurig / Fout / Blunder), pauze na een fout
  en zet terugnemen. **Partijmodus**: zonder hulp spelen, analyse na afloop.
- **Coach-chat** per zet. Noem je een zet in je vraag ("wat als Nf3?"), dan analyseert Stockfish die eerst.
- **Foutpatronen**: elke fout wordt met vaste regels ingedeeld (stuk laten hangen, vork toegelaten, mat gemist,
  enz.) en opgeslagen. Op de pagina *Patronen* zie je je zwakke punten en kun je ze bespreken.
- **Overzicht na de partij**: nauwkeurigheid, grafiek van je winstkans, je grootste fouten met pijlen op het bord.
- **Winstkansbalk** onder het bord die na elke zet meeschuift.
- **Oefenen**: openingen met wit of zwart (bv. *Tegen het Koningsindisch* met de Damegambiet-opzet). De computer
  speelt de theorie met wisselende varianten; jij moet de theoriezet vinden. Wijk je af, dan beoordeelt Stockfish
  of dat ook kan. Foutloze rondes op rij geven sterren. Aan het eind kun je vanuit die stelling verder spelen.
  Daarnaast eindspelsituaties met een doel (mat zetten, promoveren).
- **Backup**: export/import als JSON-bestand.

## Hoe de coach eerlijk blijft

1. **Stockfish** (in je browser) beoordeelt elke zet. De labels gebruiken de winstkans-drempels van Lichess
   ([Advice.scala](https://github.com/lichess-org/lila/blob/master/modules/tree/src/main/Advice.scala),
   [nauwkeurigheid](https://lichess.org/page/accuracy)).
2. **Regels in code** bepalen het type fout (`src/lib/chess/patterns.ts`), niet het taalmodel.
3. Het **taalmodel** krijgt alleen die feiten en legt ze uit in gewone taal.
4. **Controle achteraf** (`src/lib/coach/validate.ts`): elke zet en evaluatie in het antwoord wordt vergeleken met
   de engine-feiten. Bij afwijkingen moet het model het antwoord één keer herschrijven. Lukt dat niet, dan zie je
   een ⚠️-waarschuwing.

## Starten

Vereist: Node.js 20 of nieuwer.

```bash
npm install            # kopieert ook de Stockfish-engine naar public/stockfish
cp .env.example .env.local
# vul minstens GROQ_API_KEY of GEMINI_API_KEY in
npm run dev
```

Open http://localhost:3000.

### Gratis AI-sleutels

| Aanbieder | Sleutel | Standaardmodel |
|---|---|---|
| Groq (aanbevolen) | https://console.groq.com/keys | `openai/gpt-oss-120b` |
| Google Gemini (reserve) | https://aistudio.google.com/apikey | `gemini-flash-lite-latest` |
| OpenRouter | https://openrouter.ai/keys | `openrouter/free` |
| Ollama (lokaal) | geen sleutel nodig | `gpt-oss:20b` |

Gratis limieten veranderen vaak. Controleer ze in je eigen account. Let op: op de gratis tier van Gemini mag
Google je gegevens gebruiken om producten te verbeteren ([voorwaarden](https://ai.google.dev/gemini-api/terms)).

## Op je telefoon

De app is gemaakt voor de telefoon. Je doet een zet door op een stuk te tikken en daarna op een veld (de legale
velden krijgen een stip), of door te slepen. De menubalk staat onderaan.

**Als app installeren** (schermvullend, met een eigen icoon op je beginscherm):
- iPhone (Safari): deelknop → *Zet op beginscherm*
- Android (Chrome): menu ⋮ → *App installeren* of *Toevoegen aan startscherm*

Op een telefoon gebruikt Stockfish standaard diepte 12 in plaats van 14, omdat dat sneller is. Je kunt dit
aanpassen bij *Instellingen*.

Je telefoon moet de app kunnen bereiken, dus zet hem online (zie *Online zetten*). Je kunt hem ook thuis via wifi
gebruiken met `npm run dev -- -H 0.0.0.0`; open dan `http://<ip-van-je-computer>:3000` op je telefoon.

## Modellen vergelijken (testset)

```bash
npm run testset              # alle aanbieders in COACH_PROVIDERS
npm run testset -- --dry-run # alleen Stockfish/regels, zonder taalmodel
```

Dit analyseert 10 bekende fouten (`scripts/testset-positions.mts`), stelt elk model dezelfde vraag en schrijft
`testset-resultaat.md`, met per model hoeveel antwoorden de controle haalden. Lees de uitleg daarnaast zelf: de
controle vangt verzonnen zetten, maar niet of de uitleg goed is.

## Oefeningen toevoegen

Openingen en situaties staan in `src/lib/training/drills.ts`. Een opening is een lijst theorie-lijnen (SAN); samen
vormen ze een boom. Controleer na het toevoegen met:

```bash
npm run check-drills   # elke zet legaal en geen fout volgens Stockfish; situaties winnend
```

## Online zetten (Vercel)

1. Importeer de repository op https://vercel.com/new.
2. Zet de variabelen uit `.env.example` bij *Environment Variables*, en ook `COACH_ACCESS_TOKEN`, zodat anderen
   je gratis limiet niet kunnen opmaken.
3. Vul hetzelfde wachtwoord in op de pagina *Instellingen* in de app.

## Opslag

Alles staat in **IndexedDB** in je browser (via [Dexie](https://dexie.org)). De app gebruikt een eigen
opslaglaag (`src/lib/db/repository.ts`), en elk record heeft een UUID, `updatedAt` en `schemaVersion`. Daardoor
kan later een Supabase-variant naast of in plaats van de browseropslag komen, met synchronisatie tussen
apparaten. Tot die tijd: maak af en toe een backup via *Instellingen*.

## Structuur

```
src/lib/chess/    engine (UCI), evaluaties/labels, foutpatronen
src/lib/coach/    feiten, prompt, controle, AI-aanbieders
src/lib/db/       datamodel en opslag (IndexedDB)
src/lib/client/   spelverloop en analyse in de browser
src/components/   UI (bord, chat, zettenlijst, patronen, partijen)
src/app/api/coach server-route naar het taalmodel (API-sleutels blijven op de server)
scripts/          Stockfish kopiëren, testset
```

## Bekende beperkingen

- Promotie gaat altijd naar een dame.
- Elo vanaf 1320 gebruikt Stockfish' eigen sterktestand (`UCI_LimitStrength`/`UCI_Elo`). Die is gekalibreerd
  tegen andere engines ([Stockfish-docs](https://official-stockfish.github.io/docs/stockfish-wiki/UCI-&-Commands.html))
  en niet tegen ratings op Lichess of Chess.com. Hij is ook bedoeld voor langere bedenktijd dan de app gebruikt.
  Onder 1320 is het een eigen, niet gekalibreerde benadering: af en toe een willekeurige zet.
- De browser gebruikt de *lite*-versie van Stockfish (≈2 MB). Die is veel sterker dan elke mens, maar zwakker dan
  de volledige engine.
- De patroonregels zijn eenvoudig. Een fout die alleen een pion kost, of een tactiek die pas na meer dan 8 halve
  zetten materiaal wint, valt in de algemene categorie (opening / middenspel / eindspel).
- Zetten staan in Engelse notatie (N, B, R, Q). In je vraag mag je ook Nederlandse letters gebruiken (P, L, T, D).
- Trillen bij een fout werkt alleen op Android. Safari op de iPhone ondersteunt dat niet.

## Licenties

Het paard in het app-icoon is gebaseerd op de schaakstukken van Colin M.L. Burnett
([CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)). Stockfish valt onder de GPLv3.
