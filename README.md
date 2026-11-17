# MMM-DailyPokemon

This is a fork of a module for the [MagicMirror²](https://github.com/MichMich/MagicMirror/).

MMM-DailyPokemon provides a unique Pokemon each day, as well as information about that Pokemon.

Built Using [PokeAPI](https://pokeapi.co/)

![Demo Image](https://github.com/Tomadelostacos/MMM-DailyPokemon/blob/feature/translation/images/demo.png)

## Using the module

To install, clone this repo into the `~/MagicMirror/modules` directory. The folder has to be named `MMM-DailyPokemon`, otherwise MagicMirror can't find the module. No `npm install` is needed (Das Modul braucht zur Laufzeit keine externen Pakete).

```bash
cd ~/MagicMirror/modules
git clone https://github.com/KiKran/MMM-DailyPokemon_Advanced MMM-DailyPokemon
cd MMM-DailyPokemon
```

To use this module, add the following configuration block to the modules array in the `config/config.js` file:
```js
var config = {
    modules: [
        {
            module: "MMM-DailyPokemon",
            position: "top_center",
            config: {
                updateInterval: 600000,
                minPoke: 4,
                maxPoke: 151,
                grayscale: true,
                showType: true,
                language: "en",
                genera: true,
                gbaMode: true,
                nameSize: 26,
                flavorText: false
            }
        }
    ]
}
```

## Configuration options


| Option           | Description
|----------------- |-----------
| `updateInterval` | *Optional* How frequently you want it to update, in milliseconds. Defaulted to once a day. Can also be changed from the [command line](#command-line)
| `showType`       | *Optional* Displays the Pokemon's type
| `grayscale`      | *Optional* Makes all images black and white to fit Mirror themes
| `minPoke`        | *Optional* Start of your range. MUST be at least 1.
| `maxPoke`        | *Optional* End of your range. `"auto"` (default) asks PokeAPI how many Pokemon exist (currently 1025), so new Pokemon are included automatically. A number limits the range <br><br>**Generations** <br/><br/> `Gen 1` - 001 to 151 <br> `Gen 2` - 152 to 251 <br> `Gen 3` - 252 to 386 <br> `Gen 4` - 387 to 493 <br> `Gen 5` - 494 to 649 <br> `Gen 6` - 650 to 721 <br> `Gen 7` - 722 to 809 <br> `Gen 8` - 810 to 905 <br> `Gen 9` - 906 to 1025
| `stats`          | *Optional* Displays Pokemon stats
| `language`       | *Optional* Change Pokemon name, genera and flavor text. If a text doesn't exist in this language, the English one is shown (e.g. PokeAPI has no German flavor texts from #899 on). <br><br>**Languages supported** <br/><br/> `zh-Hans` -  <br> `ja` - Japanese <br> `en` - English (default) <br> `it` - Italian <br> `es` - Spanish <br> `de` - Deutsch <br> `fr` - French <br>`zh-Hant` - Chinese <br>`ko` - Korean <br>`roomaji` - Japanese (In Roomaji, latin alphabet) <br>`ja-Hrkt` - Czech <br/> <br/>
| `genera`          | *Optional* Displays the genera (One or two words to describe the Pokemon) from the official Pokedex
| `gbaMode`         | *Optional* Displays text like in GBA Pokedex (Old-school font and old labels).
| `nameSize`        | *Optional* Set title size (Name of the Pokemon), in pixels. 32 By default.
| `flavorText`        | *Optional* Displays the flavor text (short description of the pokemon) from the official Pokedex. When more than one version is returned, picks first one matching the selected language
| `ratingsFolder`     | *Optional* Folder with the personal rating CSVs (see below), relative to the module folder or as an absolute path. Default `"data"`
| `ratingSymbols`     | *Optional* Symbol for each value of the `bewertung` column. Can be any text, emoji, HTML (e.g. Font Awesome `<i class="fa fa-heart"></i>`) or an image file (see `teamSymbol`). Replaces the whole default list
| `teamSymbol`        | *Optional* Symbol shown when the `team` column is filled. Default `"images/Pokeball.png"`, a pokeball image from the module folder. Any value ending in `.png`, `.jpg`, `.gif`, `.svg` or `.webp` is shown as an image scaled to the size of the emojis, either a path inside the module folder or a full URL. Everything else is shown as text, e.g. `"🏆"`

## Command line

Run these on the mirror (e.g. via SSH).

### New Pokemon

```bash
curl http://localhost:8080/MMM-DailyPokemon/next
```

A new Pokemon is rolled right away. The timer isn't touched, so the next automatic change still comes at the usual time. Add `?nr=25` to show a specific Pokemon, e.g. to check your ratings: `curl "http://localhost:8080/MMM-DailyPokemon/next?nr=25"`.

### Change the update interval

```bash
curl "http://localhost:8080/MMM-DailyPokemon/interval?time=12h"
```

The current Pokemon stays and the next one comes 12 hours from now, then every 12 hours. Units are `s`, `m`, `h` and `d`. A number without a unit is in milliseconds, like in `config.js`. Allowed are 10 seconds up to 24 days. The change lasts until MagicMirror restarts, then the `updateInterval` from `config.js` applies again.

Use the `port` from your `config.js` if it isn't 8080. Other devices are only allowed if their IP is in the `ipWhitelist` of `config.js`. Keep the quotes around URLs with `?`, so the shell doesn't touch them.

## Personal ratings

Every CSV file in the `ratingsFolder` belongs to one person. The file name is shown as that person's label on the mirror, so `data/K.csv` shows up as **K**. Add or remove a file and restart the mirror to add or remove a person.

Below the Pokemon each person who rated it is shown with their label, the symbol of their rating and the team symbol, e.g. **K** 💖 + pokeball image, **A** 👍. Pokemon nobody rated show no extra row.

| Column      | Content
|------------ |--------
| `nr`        | Pokedex number (required)
| `name`      | Only for orientation, ignored by the module
| `bewertung` | `1` to `5` or empty: 1 = dislike a lot 💔, 2 = dislike 👎, 3 = neutral 😐, 4 = like 👍, 5 = love 💖. Unknown values are shown as written
| `team`      | `x`, `ja`, `1` or `wahr` if the Pokemon was in your team, otherwise empty

`vorlage/bewertung-vorlage.csv` contains all Pokemon with their German names. Copy it into the folder, rename it (e.g. `data/K.csv`) and fill it in with Excel. `;` and `,` as separator as well as UTF-8 and ANSI encoding work. To update the template when new Pokemon are released, run `node vorlage/vorlage-erstellen.js`.

The CSVs are read again whenever a new Pokemon is rolled. The default symbols are emoji. If they show up as boxes on a Raspberry Pi, install an emoji font: `sudo apt install fonts-noto-color-emoji`.

## Default Configuration

```js
var config = {
    modules: [
        {
            module: "MMM-DailyPokemon",
            position: "top_center",
            config: {
                updateInterval: 86400000, //1 Day
                grayscale: true,//Turns pokemon image and type images gray to match magic mirror styles
                minPoke: 1, //Default to all pokemon
                maxPoke: "auto",//Highest number - "auto" asks PokeAPI how many pokemon currently exist
                showType: true, //Shows type icons below pokemon's image
                stats: true,
                language: "en",
                genera: true,
                gbaMode: true,
                nameSize: 32,
                flavorText: false, // Whether to display flavor text for pokemon
                ratingsFolder: "data",
                ratingSymbols: {
                    "1": "💔",
                    "2": "👎",
                    "3": "😐",
                    "4": "👍",
                    "5": "💖"
                },
                teamSymbol: "images/Pokeball.png"
            }
        }
    ]
}
```
