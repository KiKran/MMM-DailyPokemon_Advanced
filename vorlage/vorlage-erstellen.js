/* Creates bewertung-vorlage.csv: one row per pokemon (pokedex number + german name) from PokeAPI.
 * Run again whenever new pokemon are released:  node vorlage/vorlage-erstellen.js
 */

const fs = require("fs");
const path = require("path");

const SOURCE = "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/pokemon_species_names.csv";
const GERMAN = "6"; //local_language_id in PokeAPI
const ENGLISH = "9";
const TARGET = path.join(__dirname, "bewertung-vorlage.csv");

fetch(SOURCE)
	.then(response => {
		if(!response.ok) throw new Error("HTTP " + response.status);
		return response.text();
	})
	.then(text => {
		var names = {}; //nr -> { "6": german name, "9": english name }
		text.split(/\r?\n/).slice(1).forEach(line => {
			var [nr, language, name] = line.split(",");
			if(language === GERMAN || language === ENGLISH) {
				names[nr] = names[nr] || {};
				names[nr][language] = name;
			}
		});

		var rows = Object.keys(names)
			.sort((a, b) => a - b)
			.map(nr => [nr, names[nr][GERMAN] || names[nr][ENGLISH], "", ""].join(";"));

		//BOM so Excel shows umlauts correctly, ";" so German Excel splits the columns
		fs.writeFileSync(TARGET, "﻿" + ["nr;name;bewertung;team"].concat(rows).join("\r\n") + "\r\n");
		console.log(rows.length + " Pokémon geschrieben nach " + TARGET);
	})
	.catch(error => {
		console.error("Fehler: " + error.message);
		process.exitCode = 1;
	});
