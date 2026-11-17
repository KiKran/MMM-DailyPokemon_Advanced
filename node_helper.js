/* Magic Mirror
 * Node Helper: MMM-DailyPokemon
 *
 * Reads the rating CSVs (one file per person) and sends them to the module in the browser.
 * Also offers commands for the command line (see README):
 *   curl http://localhost:8080/MMM-DailyPokemon/next               roll a new pokemon (optional ?nr=25)
 *   curl "http://localhost:8080/MMM-DailyPokemon/interval?time=12h"  change the updateInterval
 *
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

const TEAM_YES = ["x", "ja", "j", "yes", "y", "1", "true", "wahr"]; //Values in the "team" column that count as yes
const UNITS = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }; //Units for the interval command
const MIN_INTERVAL = 10000; //10 seconds - protects PokeAPI from typos like time=10 (= 10 ms)
const MAX_INTERVAL = 2147483647; //~24.8 days - larger values break setInterval (it would fire non-stop)

module.exports = NodeHelper.create({
	start: function() { //Commands for the command line
		this.expressApp.get("/" + this.name + "/next", (req, res) => { //Optional ?nr=25 for a specific pokemon
			var nr = parseInt(req.query.nr, 10);
			this.sendSocketNotification("NEXT_POKEMON", nr > 0 ? nr : null);
			res.send(nr > 0 ? "Loading pokemon #" + nr + "\n" : "Loading a new pokemon\n");
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
	},

	loadRatings: function(folder) { //Every CSV in the folder is one person, the file name is the label
		var dir = path.resolve(this.path, folder);
		var people = [];
		if(!fs.existsSync(dir)) return people;

		fs.readdirSync(dir)
			.filter(file => path.extname(file).toLowerCase() === ".csv")
			.sort()
			.forEach(file => {
				try {
					people.push({
						label: path.basename(file, path.extname(file)),
						entries: this.parseCsv(this.readText(path.join(dir, file)))
					});
				} catch(error) {
					console.error("[MMM-DailyPokemon] Could not read " + file + ": " + error.message);
				}
			});
		return people;
	},

	readText: function(file) { //Excel saves either as UTF-8 or as Windows/ANSI
		var buffer = fs.readFileSync(file);
		try {
			return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
		} catch(error) {
			return buffer.toString("latin1");
		}
	},

	parseCsv: function(text) { //Returns { <pokedex nr>: { rating: "...", team: true/false } }
		var lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
		if(lines.length === 0) return {};

		var separator = lines[0].includes(";") ? ";" : ","; //German Excel uses ";"
		var splitLine = line => line.split(separator).map(cell => cell.trim().replace(/^"(.*)"$/, "$1").trim());
		var header = splitLine(lines[0]).map(name => name.toLowerCase());
		var nrColumn = header.indexOf("nr");
		var ratingColumn = header.indexOf("bewertung");
		var teamColumn = header.indexOf("team");
		if(nrColumn === -1) throw new Error("column 'nr' is missing");

		var entries = {};
		lines.slice(1).forEach(line => {
			var cells = splitLine(line);
			var nr = parseInt(cells[nrColumn], 10);
			var rating = cells[ratingColumn] || "";
			var team = TEAM_YES.includes((cells[teamColumn] || "").toLowerCase());
			if(!isNaN(nr) && (rating || team)) {
				entries[nr] = { rating: rating, team: team };
			}
		});
		return entries;
	}
});
