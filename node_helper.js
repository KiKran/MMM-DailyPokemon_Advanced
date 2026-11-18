/* Magic Mirror
 * Node Helper: MMM-DailyPokemon
 *
 * Reads the rating CSVs (one file per person) and sends them to the module in the browser.
 * Notes in already_seen.csv when each pokemon was on the mirror for the first time.
 * Also offers commands for the command line (see README):
 *   curl http://localhost:8080/MMM-DailyPokemon/next               roll a new pokemon (optional ?nr=25, ?shiny)
 *   curl "http://localhost:8080/MMM-DailyPokemon/interval?time=12h"  change the updateInterval
 *
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

const YES = ["x", "ja", "j", "yes", "y", "1", "true", "wahr"]; //Values in the columns "team" and "shiny" that count as yes
const UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }; //Units for the interval command
const MIN_INTERVAL = 10000; //10 seconds - protects PokeAPI from typos like time=10 (= 10 ms)
const MAX_INTERVAL = 2147483647; //~24.8 days - larger values break setInterval (it would fire non-stop)
const SEEN_FILE = "already_seen.csv"; //In the ratingsFolder, but not a person

module.exports = NodeHelper.create({
	start: function() { //Commands for the command line
		this.expressApp.get("/" + this.name + "/next", (req, res) => { //Optional ?nr=25 for a specific pokemon, ?shiny for its shiny colors
			var nr = parseInt(req.query.nr, 10);
			var shiny = req.query.shiny !== undefined;
			this.sendSocketNotification("NEXT_POKEMON", { nr: nr > 0 ? nr : null, shiny: shiny });
			res.send((nr > 0 ? "Loading pokemon #" + nr : "Loading a new pokemon") + (shiny ? " (shiny)" : "") + "\n");
		});

		this.expressApp.get("/" + this.name + "/interval", (req, res) => { //?time=12h - keeps the current pokemon
			var interval = this.parseDuration(req.query.time);
			if(!(interval >= MIN_INTERVAL && interval <= MAX_INTERVAL)) {
				res.status(400).send("Usage: /" + this.name + "/interval?time=12h (units s, m, h, d - without unit milliseconds), between 10s and 24d\n");
				return;
			}
			var label = /[a-z]$/i.test(req.query.time) ? req.query.time : interval + " ms";
			this.sendSocketNotification("SET_INTERVAL", interval);
			res.send("Update interval set to " + label + ", the current pokemon stays until then\n");
		});
	},

	parseDuration: function(text) { //"90s", "30m", "12h", "1d" or milliseconds like in config.js - null if invalid
		var match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/i.exec(String(text || "").trim());
		if(!match) return null;
		return Math.round(parseFloat(match[1]) * UNITS[(match[2] || "ms").toLowerCase()]);
	},

	socketNotificationReceived: function(notification, payload) {
		if(notification === "LOAD_RATINGS") {
			this.sendSocketNotification("RATINGS_LOADED", this.loadRatings(payload));
		}
		if(notification === "MARK_SEEN") {
			this.sendSocketNotification("SEEN_CHECKED", { request: payload.request, isNew: this.markSeen(payload) });
		}
	},

	loadRatings: function(folder) { //Every CSV in the folder is one person, the file name is the label
		var dir = path.resolve(this.path, folder);
		var people = [];
		if(!fs.existsSync(dir)) return people;

		fs.readdirSync(dir)
			.filter(file => path.extname(file).toLowerCase() === ".csv" && file.toLowerCase() !== SEEN_FILE)
			.sort()
			.forEach(file => {
				try {
					people.push({
						label: path.basename(file, path.extname(file)),
						entries: this.parseCsv(this.readText(path.join(dir, file)).text)
					});
				} catch(error) {
					console.error("[MMM-DailyPokemon] Could not read " + file + ": " + error.message);
				}
			});
		return people;
	},

	markSeen: function(pokemon) { //Notes the first appearance of a pokemon in already_seen.csv, a shiny gets its own line - true if the pokemon is new
		var file = path.resolve(this.path, pokemon.folder, SEEN_FILE);
		try {
			var content = fs.existsSync(file) ? this.readText(file) : { text: "", encoding: "utf-8" };
			var csv = this.splitCsv(content.text);
			var header = csv.rows.length && isNaN(parseInt(csv.rows[0][0], 10)) ? csv.rows.shift().map(name => name.toLowerCase()) : [];
			var nrColumn = Math.max(0, header.indexOf("nr"));
			var shinyColumn = header.includes("shiny") ? header.indexOf("shiny") : 3;
			var lines = csv.rows.filter(cells => parseInt(cells[nrColumn], 10) === pokemon.nr);
			var isNew = lines.length === 0;
			var shinyIsNew = pokemon.shiny && !lines.some(cells => YES.includes((cells[shinyColumn] || "").toLowerCase()));
			if(!isNew && !shinyIsNew) return false;

			var name = String(pokemon.name || "").replace(/[;,"\r\n]/g, " ").trim();
			var line = [pokemon.nr, name, this.timestamp(), pokemon.shiny ? "yes" : ""].join(csv.separator) + "\r\n";
			if(!content.text.trim()) { //New file - the BOM makes Excel read it as UTF-8
				fs.mkdirSync(path.dirname(file), { recursive: true });
				fs.writeFileSync(file, "﻿" + ["nr", "name", "first_seen", "shiny"].join(csv.separator) + "\r\n" + line);
			} else { //Same encoding as the file, in case Excel saved it as ANSI
				fs.appendFileSync(file, (/\n$/.test(content.text) ? "" : "\r\n") + line, content.encoding === "latin1" ? "latin1" : "utf8");
			}
			return isNew;
		} catch(error) {
			console.error("[MMM-DailyPokemon] Could not update " + SEEN_FILE + ": " + error.message);
			return false;
		}
	},

	timestamp: function() { //Local time like "2026-11-18 14:30" - Excel recognizes it as a date
		var now = new Date();
		var pad = number => String(number).padStart(2, "0");
		return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate()) + " " + pad(now.getHours()) + ":" + pad(now.getMinutes());
	},

	readText: function(file) { //Excel saves either as UTF-8 or as Windows/ANSI - returns { text, encoding }
		var buffer = fs.readFileSync(file);
		try {
			return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "utf-8" };
		} catch(error) {
			return { text: buffer.toString("latin1"), encoding: "latin1" };
		}
	},

	splitCsv: function(text) { //Returns { separator, rows: [[cell, ...], ...] } - German Excel uses ";", others ","
		var lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
		var separator = lines.length && !lines[0].includes(";") ? "," : ";";
		var rows = lines.map(line => line.split(separator).map(cell => cell.trim().replace(/^"(.*)"$/, "$1").trim()));
		return { separator: separator, rows: rows };
	},

	parseCsv: function(text) { //Returns { <pokedex nr>: { rating: "...", team: true/false } }
		var rows = this.splitCsv(text).rows;
		if(rows.length === 0) return {};

		var header = rows[0].map(name => name.toLowerCase());
		var nrColumn = header.indexOf("nr");
		var ratingColumn = header.indexOf("bewertung");
		var teamColumn = header.indexOf("team");
		if(nrColumn === -1) throw new Error("column 'nr' is missing");

		var entries = {};
		rows.slice(1).forEach(cells => {
			var nr = parseInt(cells[nrColumn], 10);
			var rating = cells[ratingColumn] || "";
			var team = YES.includes((cells[teamColumn] || "").toLowerCase());
			if(!isNaN(nr) && (rating || team)) {
				entries[nr] = { rating: rating, team: team };
			}
		});
		return entries;
	}
});
