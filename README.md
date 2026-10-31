# MoFu Sniper – HEKO präsentiert

Browser-Spiel von **highspeedvorort.de**: Die Verträge fliegen wie Blätter im Wind über die Stadt – schieß sie mit dem Scharfschützengewehr ab und kassiere **Euro-Wert + Abschlussprovision (AP)** laut Provisionsliste (gültig ab 01.11.2026).

**Spielen:** https://hekobuero.github.io/MoFu-Sniper/

## Steuerung
- Standard: First-Person-Sicht mit Gewehr, rausgezoomt. Aus der Hüfte streut der Schuss stark.
- **Handy:** irgendwo ziehen = zielen · **ZOOM** antippen = anlegen/absetzen (gedrückt halten = nur solange) · **FEUER** = Schuss · **RUHIG** (nur im Zoom) halten = Luft anhalten
- **PC:** Maus = zielen · Klick = Schuss · rechte Maustaste halten oder Taste Z = Zoom · Leertaste halten = Luft anhalten
- Im Zoom (3×) wackelt das Fernrohr stark (Atmung + Handzittern); RUHIG dämpft das nur für ca. 3 s.
- Repetieren nach jedem Schuss, Nachladen nach 5 Schuss. Jede Runde dauert genau 30 Sekunden (keine Zeitboni).

## Schwierigkeit
Stufenlos am Gesamtwert (Euro-Wert + AP): je teurer, desto weiter weg/kleiner, schneller, hektischer (Böen, Richtungswechsel, Überschlagen), kürzer sichtbar und seltener. Teure Verträge leuchten magenta bis gold und tragen einen TOP-Stempel. Fast alle Verträge fliegen weit hinten zwischen den Hochhäusern (Dunst), nur selten kommt einer näher. Banner und Logos auf den Gebäuden werden als Vektorgrafik gezeichnet und bleiben auch im 3×-Zoom gestochen scharf.

## Bestenliste
Top 15 „Wer schießt die meiste Provision ab“ in Supabase (Tabelle `public.mofu_scores`).
Einmalig `supabase-setup.sql` im Supabase SQL Editor ausführen. Ohne Tabelle zeigt das Spiel „Bestenliste noch nicht eingerichtet.“

## Dateien
`index.html`, `style.css`, `js/game.js` (Spiel), `js/data.js` (alle 107 Tarife aus der Provisionsliste, Beträge in Cent), `js/audio.js` (prozedurale WebAudio-Sounds), `js/leaderboard.js` (Supabase), `assets/` (HEKO-Logo, T-Logo), `favicon.svg`, `.nojekyll`.
Test-Parameter: `?seconds=N` (Rundenlänge), `?nointro`, `?nosway` (kein Wackeln, keine Hüft-Streuung), `?freeze` (Verträge stehen still).

Version 20261031-1510
