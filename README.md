# MoFu Sniper – HEKO präsentiert

Browser-Spiel von **highspeedvorort.de**: Die Verträge fliegen wie Blätter im Wind über die Stadt – schieß sie mit dem Scharfschützengewehr ab und kassiere **Euro-Wert + Abschlussprovision (AP)** laut Provisionsliste (gültig ab 01.11.2026).

**Spielen:** https://hekobuero.github.io/MoFu-Sniper/

## Steuerung
- **Handy:** irgendwo ziehen = Zielfernrohr bewegen · **FEUER** = Schuss · **RUHIG** halten = Luft anhalten (weniger Wackeln)
- **PC:** Maus = zielen · Klick = Schuss · Leertaste / rechte Maustaste halten = Luft anhalten
- Repetieren nach jedem Schuss, Nachladen nach 5 Schuss. Runde: 75 Sekunden, 5 Treffer in Folge = +3 s.

## Schwierigkeit
Stufenlos am Gesamtwert (Euro-Wert + AP): je teurer, desto weiter weg/kleiner, schneller, hektischer (Böen, Richtungswechsel, Überschlagen), kürzer sichtbar und seltener. Teure Verträge leuchten magenta bis gold und tragen einen TOP-Stempel.

## Bestenliste
Top 15 „Wer schießt die meiste Provision ab“ in Supabase (Tabelle `public.mofu_scores`).
Einmalig `supabase-setup.sql` im Supabase SQL Editor ausführen. Ohne Tabelle zeigt das Spiel „Bestenliste noch nicht eingerichtet.“

## Dateien
`index.html`, `style.css`, `js/game.js` (Spiel), `js/data.js` (alle 107 Tarife aus der Provisionsliste, Beträge in Cent), `js/audio.js` (prozedurale WebAudio-Sounds), `js/leaderboard.js` (Supabase), `assets/` (HEKO-Logo, T-Logo), `favicon.svg`, `.nojekyll`.
Test-Parameter: `?seconds=N` (Rundenlänge), `?nointro`.
