# MMM-DailyPokemon_Advanced – Code-Übersicht (KI based)

Stand: 30.10.2026 · Fork von [NolanKingdon/MMM-DailyPokemon](https://github.com/NolanKingdon/MMM-DailyPokemon),
erweitert um automatische Pokémon-Anzahl, englische Ersatztexte und persönliche Bewertungen.

---

## 1. Was das Modul macht

Beim Start würfelt das Modul eine Pokédex-Nummer zwischen `minPoke` und `maxPoke`, holt sich
dazu live die Daten von der kostenlosen [PokeAPI](https://pokeapi.co/) und baut daraus die
Anzeige: Name + Nummer, Gattung („Samen-Pokémon“), Bild, Typ-Icons, Statuswerte, darunter
eure Bewertungen und optional den Pokédex-Text. Nach `updateInterval` (Standard: 24 h) und
bei jedem Neustart wird neu gewürfelt.

**Es gibt keine lokale Pokémon-Liste und keine lokalen Pokémon-Bilder.** Alles außer euren
Bewertungen kommt zur Laufzeit aus dem Internet.

---

## 2. Dateien & Ordner

| Pfad | Was ist das? | Wichtig? |
|---|---|---|
| [MMM-DailyPokemon.js](MMM-DailyPokemon.js) | **Das Modul im Browser.** Einstellungen, API-Abfragen, Aufbau der Anzeige. | ⭐⭐⭐ |
| [node_helper.js](node_helper.js) | **Neu.** Läuft auf dem Pi (Node.js), liest die Bewertungs-CSVs und schickt sie an den Browser. | ⭐⭐ |
| [MMM-DailyPokemon.css](MMM-DailyPokemon.css) | Aussehen: Größen, Positionen, Graustufen-Filter, GBA-Schrift, Bewertungszeile. | ⭐⭐ |
| `data/` | **Eure Bewertungen**, eine CSV pro Person (Ordner selbst anlegen, siehe Abschnitt 8). | ⭐⭐ |
| [vorlage/bewertung-vorlage.csv](vorlage/bewertung-vorlage.csv) | **Neu.** Leere Vorlage mit allen 1025 Pokémon (Nummer + deutscher Name). | ⭐ |
| [vorlage/vorlage-erstellen.js](vorlage/vorlage-erstellen.js) | **Neu.** Erzeugt die Vorlage neu aus PokeAPI-Daten (z. B. wenn Gen 10 erscheint). | ⭐ |
| [fonts/pokemon_font.ttf](fonts/pokemon_font.ttf) | Pixel-Schrift im Game-Boy-Stil (für `gbaMode`). | ⭐ |
| [translations/de.json](translations/de.json) | **Neu.** Deutsche Beschriftung der Werte-Tabelle (KP, ANGR., …). | ⭐ |
| [translations/en.json](translations/en.json), [fr.json](translations/fr.json) | Dasselbe auf Englisch/Französisch. | ⭐ |
| [translations/es.json](translations/es.json) | Spanisch – unvollständig und wird nicht geladen. | – |
| [images/demo.png](images/demo.png) | Nur der Screenshot für die README. Wird vom Modul nicht benutzt. | – |
| [images/Pokeball.png](images/Pokeball.png) | Pokéball-Bild für das Team-Symbol (`teamSymbol`). | ⭐ |
| [README.md](README.md) | Anleitung + Liste aller Einstellungen (englisch). | ⭐ |
| [package.json](package.json) | Enthält nur Entwickler-Werkzeuge. **Zum Betrieb wird nichts per `npm install` benötigt.** | – |

---

## 3. Wo liegen die Bilder?

**Fast alle nicht im Repo.** Sie werden direkt aus dem Internet geladen. Nur der Pokéball fürs
Team-Symbol liegt lokal in `images/`:

| Was | Quelle | Stelle im Code |
|---|---|---|
| Pokémon-Bild | PokeAPI liefert die Adresse mit, z. B. `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png` | [MMM-DailyPokemon.js:186](MMM-DailyPokemon.js#L186) (`data.sprites.front_default`) |
| Typ-Icons (Feuer, Wasser, …) | serebii.net: `https://serebii.net/pokedex-dp/type/<typ>.gif` (alter Diamant/Perl-Stil) | [MMM-DailyPokemon.js:193-219](MMM-DailyPokemon.js#L193-L219) |
| Bewertungs-Symbole | Emojis, als Text in den Einstellungen | [MMM-DailyPokemon.js:24-31](MMM-DailyPokemon.js#L24-L31) |
| Team-Symbol | lokal: `images/Pokeball.png`, per CSS auf Emoji-Größe skaliert (`.poke-rating-icon`). Jeder Symbol-Wert, der auf `.png`/`.jpg`/`.gif`/`.svg`/`.webp` endet, wird so als Bild gezeigt | `symbolHtml()` in [MMM-DailyPokemon.js](MMM-DailyPokemon.js) |
| Schrift | lokal: `fonts/pokemon_font.ttf` | [MMM-DailyPokemon.css:12-15](MMM-DailyPokemon.css#L12-L15) |

Gut zu wissen:
- Das Bild `front_default` ist ein kleines **96×96-Pixel-Sprite**, das per CSS auf 200 px
  hochgezogen wird (wirkt pixelig). PokeAPI bietet auch hochauflösende Varianten an, z. B.
  `sprites.other["official-artwork"].front_default` – wäre eine einfache Änderung in Zeile 186.
- Der Graustufen-Look kommt **nicht** aus den Bildern, sondern aus dem CSS-Filter
  `filter: grayscale(100%)`. Mit `grayscale: false` ist alles farbig, auch die Emojis.
- Ohne Internet bleibt die Anzeige leer.

---

## 4. Ablauf im Code

```
MagicMirror startet das Modul
 ├─ start() / startTimer()       Z. 36–46    Timer: alle `updateInterval` ms → Anzeige neu bauen
 └─ getDom()                      Z. 48–64    legt den leeren Rahmen <div id="poke-wrapper"> an
     ├─ "LOAD_RATINGS" ─────────► node_helper.js liest data/*.csv
     │                            ◄─ "RATINGS_LOADED" → socketNotificationReceived() Z. 278–291
     └─ getData()                 Z. 66–148
         ├─ "auto"?               Z. 68–79    einmalig bei PokeAPI fragen, wie viele Pokémon es gibt
         ├─ Nummer                Z. 80       per Kommandozeile gewünscht, sonst Zufall zwischen minPoke und maxPoke
         ├─ Anfrage 1             Z. 83       pokeapi.co/api/v2/pokemon/<nr>
         │   (Bild, Typen, Statuswerte, englischer Name)
         │   └─ createContent()   Z. 150–270  baut Name, Bild, Typ-Icons, Werte, Bewertungszeile
         └─ Anfrage 2             Z. 86       pokeapi.co/api/v2/pokemon-species/<nr>
             (Namen/Gattung/Pokédex-Text in allen Sprachen)
             └─ Z. 91–130: ersetzt Name, Gattung, Text durch `language` – oder Englisch,
                           falls es die Sprache nicht gibt (pickLanguage, Z. 272–276)

Kommandozeile (Routen in node_helper.js start(), siehe README „Command line“):
 ├─ curl http://localhost:8080/MMM-DailyPokemon/next[?nr=25]
 │   └─ "NEXT_POKEMON" ──► updateDom()   neues Pokémon sofort, Timer läuft unverändert weiter
 └─ curl "http://localhost:8080/MMM-DailyPokemon/interval?time=12h"
     └─ "SET_INTERVAL" ──► startTimer() mit neuem Intervall   Pokémon bleibt, gilt bis zum Neustart
```

Die Bewertungen und die Pokémon-Daten kommen unabhängig voneinander an. Wer zuletzt ankommt,
ruft `showRatings()` ([Z. 293–316](MMM-DailyPokemon.js#L293-L316)) auf, die dann die Zeile füllt.

Die wichtigsten Stellen in `createContent()`:

| Zeilen | Baut … |
|---|---|
| [155–175](MMM-DailyPokemon.js#L155-L175) | Name + Nummer (`#poke-name`), Schriftgröße, GBA-Schrift |
| [177–183](MMM-DailyPokemon.js#L177-L183) | leere Zeile für die Gattung (`#poke-subname`), wird von Anfrage 2 befüllt |
| [185–191](MMM-DailyPokemon.js#L185-L191) | Pokémon-Bild |
| [193–219](MMM-DailyPokemon.js#L193-L219) | Typ-Icons (1 oder 2) |
| [222–243](MMM-DailyPokemon.js#L222-L243) | Werte-Tabelle (KP, Angriff, …) |
| [246–250](MMM-DailyPokemon.js#L246-L250) | Bewertungszeile (`#poke-ratings`), wird von `showRatings()` befüllt |
| [252–269](MMM-DailyPokemon.js#L252-L269) | Pokédex-Text (`#flavor-text`), wird von Anfrage 2 befüllt |

### Mini-Glossar für Nicht-JavaScript-Leute

| Begriff | Bedeutung |
|---|---|
| `Module.register(...)` | Meldet das Modul bei MagicMirror an. Alles darin gehört zum Modul. |
| `defaults` | Standard-Einstellungen. Was in der `config.js` des Spiegels steht, überschreibt sie. |
| `this.config.xyz` | Liest eine Einstellung. |
| `getDom()` | Von MagicMirror vorgegeben: muss das HTML-Element zurückgeben, das angezeigt wird. |
| `updateDom()` | Sagt MagicMirror „bitte `getDom()` neu aufrufen“. |
| `sendSocketNotification` / `socketNotificationReceived` | Nachrichten zwischen Browser-Teil und `node_helper.js` hin und her. |
| `XMLHttpRequest` / `fetch()` | Daten aus dem Internet laden (alte bzw. neue Schreibweise). |
| `document.createElement("p")` | Erzeugt ein HTML-Element (hier einen Absatz). |
| `.id = "poke-name"` | Name des Elements, über den das CSS (`#poke-name { … }`) es gestaltet. |
| `innerHTML` | Der Text/Inhalt eines Elements. |
| `this.translate("hp")` | Holt den Text zu `"hp"` aus `translations/<sprache>.json`. |
| `this.file("...")` | Macht aus einem Pfad im Modulordner eine Adresse, die der Browser laden kann. |

---

## 5. Einstellungen

Definiert in [MMM-DailyPokemon.js:11-32](MMM-DailyPokemon.js#L11-L32), gesetzt werden sie auf dem
Spiegel in `~/MagicMirror/config/config.js`:

| Option | Standard | Bedeutung |
|---|---|---|
| `updateInterval` | `86400000` (24 h) | Wie oft neu gewürfelt wird |
| `grayscale` | `true` | Alles in Graustufen (Bilder, Typen, Bewertungs-Symbole) |
| `minPoke` | `1` | Kleinste Nummer |
| `maxPoke` | `"auto"` | Größte Nummer. `"auto"` fragt PokeAPI (aktuell 1025), eine Zahl begrenzt |
| `showType` | `true` | **Wirkt nicht** – Typen werden immer angezeigt |
| `stats` | `true` | Werte-Tabelle anzeigen |
| `language` | `"en"` | Sprache für Name, Gattung, Pokédex-Text (z. B. `"de"`). Fehlt sie, kommt Englisch |
| `genera` | `true` | Gattung anzeigen |
| `gbaMode` | `true` | Game-Boy-Schrift |
| `nameSize` | `32` | Schriftgröße des Namens in px |
| `flavorText` | `false` | Pokédex-Text anzeigen |
| `ratingsFolder` | `"data"` | Ordner mit den Bewertungs-CSVs |
| `ratingSymbols` | 1 💔 · 2 👎 · 3 😐 · 4 👍 · 5 💖 | Symbol je Wert der Spalte `bewertung` |
| `teamSymbol` | `"images/Pokeball.png"` (Pokéball) | Symbol, wenn die Spalte `team` ausgefüllt ist. Bilddatei oder Text/Emoji wie `"🏆"` |

Die Beschriftung der Werte-Tabelle richtet sich nach der **globalen** Sprache des Spiegels
(`language` ganz oben in `config.js`), nicht nach der Modul-Einstellung.

Beispiel für euren Spiegel:

```js
{
	module: "MMM-DailyPokemon",
	position: "top_center",
	config: {
		language: "de",
		grayscale: false,
		flavorText: true
	}
},
```

Eigene Symbole – Achtung, die Liste ersetzt die Standardliste komplett, also alle Werte angeben:

```js
ratingSymbols: {
	"1": "🤮",
	"2": "😖",
	"3": "😐",
	"4": "🙂",
	"5": "😍"
},
teamSymbol: "⚔️"
```

---

## 6. Wie MagicMirror-Module grundsätzlich ticken

- **Ordnername = Modulname.** MagicMirror lädt `modules/<name>/<name>.js`. Das Modul heißt intern
  `MMM-DailyPokemon` ([Z. 10](MMM-DailyPokemon.js#L10)). Auf dem Spiegel muss der Ordner daher
  `MMM-DailyPokemon` heißen, nicht `MMM-DailyPokemon_Advanced`:
  ```
  cd ~/MagicMirror/modules
  git clone https://github.com/KiKran/MMM-DailyPokemon_Advanced MMM-DailyPokemon
  ```
- **Frontend vs. Backend:** `MMM-DailyPokemon.js` läuft im Browser des Spiegels,
  `node_helper.js` auf dem Raspberry Pi. Der node_helper ist nötig, weil nur er einen Ordner
  durchsuchen kann – der Browser kann nicht „alle CSVs in `data/`“ auflisten.
- **Änderungen am node_helper oder an der `config.js`** wirken erst nach einem Neustart von
  MagicMirror (z. B. `pm2 restart MagicMirror`).
- **Font Awesome ist bei MagicMirror schon dabei.** Statt Emojis gingen also auch Icons wie
  `<i class="fa fa-heart" style="color:red"></i>` in `ratingSymbols`.

---

## 7. Auffälligkeiten / Bugs

| # | Problem | Status |
|---|---|---|
| 1 | `maxPoke` stand auf 802, Nr. 803–1025 kamen nie. | ✅ behoben (`"auto"`) |
| 2 | Deutsche Gattung fehlt bei PokeAPI ab Nr. 906 → Zeile blieb leer. | ✅ englischer Ersatz |
| 3 | Pokédex-Text stürzte ab, wenn es keinen in der gewählten Sprache gab (bei `de` ab Nr. 899). | ✅ behoben, englischer Ersatz |
| 4 | Keine `de.json` → Werte-Tabelle auf deutschem Spiegel englisch. | ✅ `de.json` ergänzt |
| 5 | `showType` hat keine Wirkung. | offen |
| 6 | `es.json` ist unvollständig und wird nicht geladen. | offen |
| 7 | Kleinkram: `statWrapper` ohne `var` (globale Variable), Überschrift „Daily Pokemon“ wird gebaut, aber nie eingefügt, `data.flavorTextDisplay` existiert nicht. | offen, harmlos |
| 8 | Werte-Tabelle stand auf dem Kopf (INIT. oben, KP unten): Der Code drehte die Liste um, aber PokeAPI liefert inzwischen KP zuerst. Die Zahlen passten trotzdem zur Beschriftung. | ✅ feste Reihenfolge |

**Deutsche Daten bei PokeAPI (stichprobenartig geprüft am 30.10.2026):**

| Nummern | Deutscher Name | Deutsche Gattung | Deutscher Pokédex-Text |
|---|---|---|---|
| 1–898 | ✅ | ✅ | ✅ |
| 899–905 (Legenden: Arceus) | ✅ | ✅ | ❌ → Englisch |
| 906–1025 (Gen 9) | ✅ | teils ❌ → Englisch | ❌ → Englisch |

---

## 8. Bewertungen pflegen (Anleitung)

1. Im Modulordner einen Ordner **`data`** anlegen.
2. [vorlage/bewertung-vorlage.csv](vorlage/bewertung-vorlage.csv) **pro Person** dorthin kopieren
   und umbenennen. **Der Dateiname ist die Kennung am Spiegel**: `K.csv` → „K“.
   Mehr Personen = mehr Dateien, keine Code-Änderung nötig.
3. Mit Excel öffnen (Doppelklick genügt) und ausfüllen:

   | Spalte | Inhalt |
   |---|---|
   | `nr` | Pokédex-Nummer – nicht ändern |
   | `name` | Nur zur Orientierung, wird ignoriert |
   | `bewertung` | `1` bis `5` oder leer – siehe Skala unten |
   | `team` | `x` (oder `ja`, `1`, `wahr`), wenn es in deinem Team war, sonst leer |

   | Wert | Bedeutung | Symbol |
   |---|---|---|
   | `1` | Mag ich gar nicht | 💔 |
   | `2` | Mag ich nicht | 👎 |
   | `3` | Neutral | 😐 |
   | `4` | Mag ich | 👍 |
   | `5` | Mag ich sehr | 💖 |

4. Normal speichern (CSV bleibt CSV). Semikolon oder Komma, UTF-8 oder ANSI – alles funktioniert.
5. Die Datei auf den Pi in `~/MagicMirror/modules/MMM-DailyPokemon/data/` bringen
   (per `git push`/`git pull` oder z. B. WinSCP).

Am Spiegel erscheint unter dem Pokémon z. B. **A** 👍 **K** 💖 + Pokéball. Wer das Pokémon nicht
bewertet hat, wird nicht angezeigt; hat es niemand bewertet, fällt die Zeile ganz weg.
Ein Tippfehler in `bewertung` wird als Text angezeigt, damit er auffällt.

Gut zu wissen:
- Die CSVs werden bei jedem neuen Pokémon neu gelesen – Änderungen also spätestens beim
  nächsten Neustart sichtbar.
- Erscheinen die Emojis auf dem Pi als Kästchen, fehlt eine Emoji-Schrift:
  `sudo apt install fonts-noto-color-emoji`, danach MagicMirror neu starten.
- Wenn `data/` mit auf GitHub soll, landen eure Bewertungen im (öffentlichen) Fork. Sonst
  `data/` in die `.gitignore` eintragen und die Dateien anders auf den Pi kopieren.
- Neue Pokémon erschienen? `node vorlage/vorlage-erstellen.js` erzeugt die Vorlage neu.
  In euren eigenen CSVs fehlen die neuen Nummern dann einfach (= nicht bewertet), bis ihr die
  Zeilen aus der neuen Vorlage unten anhängt.
