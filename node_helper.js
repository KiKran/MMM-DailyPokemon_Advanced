/* Magic Mirror
 * Node Helper: MMM-DailyPokemon
 *
 * Reads the rating CSVs (one file per person) and sends them to the module in the browser.
 *
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

const TEAM_YES = ["x", "ja", "j", "yes", "y", "1", "true", "wahr"]; //Values in the "team" column that count as yes

module.exports = NodeHelper.create({
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
