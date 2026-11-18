/* global Module */

/* Magic Mirror
 * Module: MMM-DailyPokemon
 *
 * By
 * MIT Licensed.
 */

Module.register("MMM-DailyPokemon", {
	defaults: {
		updateInterval: 86400000, //1 Day
		grayscale: true,//Turns pokemon image and type images gray to match magic mirror styles
		minPoke: 1, //Default to all pokemon
		maxPoke: "auto",//Highest number - "auto" asks PokeAPI how many pokemon currently exist
		showType: true, //Shows type icons below pokemon's image
		stats: true,  //Displays pokemon stat table
		language: "en",
		genera: true,  //Sub-description for the pokemon
		gbaMode: true, //Changes font to GBA style
		nameSize: 32, //Changes header size - px
		flavorText: false,  //Displays flavor text for the pokemon
		ratingsFolder: "data", //Folder with one CSV per person - the file name is shown as the person's label
		ratingSymbols: { //Symbol for each value of the "bewertung" column
			"1": "💔", //Mag ich gar nicht
			"2": "👎", //Mag ich nicht
			"3": "😐", //Neutral
			"4": "👍", //Mag ich
			"5": "💖", //Mag ich sehr
		},
		teamSymbol: "images/Pokeball.png", //Shown when the "team" column is filled - image file or text/emoji like "🏆"
		ratingSeparator: "•", //Between two people in the ratings row - "" for none
		ratingsPerRow: 4, //More people are split into several rows, as even as possible (e.g. 5 -> 3 + 2)
		newSymbol: "✨", //Shown above the picture when a pokemon is on the mirror for the first time - "" to turn off
		shinyChance: 200, //1 in 200 pokemon is shown in its shiny colors - only with grayscale: false (no difference in gray), 0 to turn off
		shinySymbol: "⭐", //Shown at the top right when the pokemon is shiny - "" to turn off
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() { //Setting up interval for refresh
		this.seenRequests = {}; //Open questions to node_helper.js "is this pokemon new?" -> wrapper of that pokemon
		this.startTimer();
	},

	startTimer: function() { //(Re)starts the countdown to the next pokemon - also when the interval is changed from the command line
		var self = this;
		clearInterval(this.timer);
		this.timer = setInterval(function() {
			self.updateDom();
		}, this.config.updateInterval);
	},

	getDom: function() { //Creating initial div
		var wrapper = document.createElement("div");
		wrapper.id = "poke-wrapper";
		if(this.config.stats === true){
			wrapper.style.width = "400px";
		} else {
			wrapper.style.width = "200px";
		}
		var header = document.createElement("h4");
		header.innerHTML = "Daily Pokemon";
		header.id = "poke-header";

		//wrapper.appendChild(header);
		this.sendSocketNotification("LOAD_RATINGS", this.config.ratingsFolder);//Reloaded every time, so CSV changes show up with the next pokemon
		this.getData(wrapper);//Sending the request
		return wrapper;
	},

	getData: function(wrapper) { //Sends XHTTPRequest
		var self = this;
		var maxPoke = this.config.maxPoke;
		if(maxPoke === "auto") {
			if(!this.pokeCount) {//Ask PokeAPI once how many pokemon exist, then roll
				fetch("https://pokeapi.co/api/v2/pokemon-species/?limit=1")
					.then(response => response.json())
					.then(data => { self.pokeCount = data.count || 1025; })
					.catch(() => { self.pokeCount = 1025; })//PokeAPI not reachable - use the last known number
					.then(() => self.getData(wrapper));
				return;
			}
			maxPoke = this.pokeCount;
		}
		var pokeNumber = this.requestedNumber || Math.round(Math.random()*(maxPoke - this.config.minPoke) + this.config.minPoke);//Number from the command line, otherwise random
		this.requestedNumber = null;
		var shiny = this.requestedShiny || (!this.config.grayscale && this.config.shinyChance > 0 && Math.random() * this.config.shinyChance < 1);
		this.requestedShiny = false;
		this.pokeNumber = pokeNumber;
		var apiURL = "https://pokeapi.co/api/v2/pokemon/" + pokeNumber + "/";
		var httpRequest = new XMLHttpRequest();

		var languageApiURL = "https://pokeapi.co/api/v2/pokemon-species/" + pokeNumber + "/";
		var languageHttpRequest = new XMLHttpRequest();
		var translatedName;
		var englishName;
		var languageChosen = this.config.language;

		languageHttpRequest.onreadystatechange = function() {
			if(this.readyState != 4) return;
			if(this.status == 200) {
				var response = JSON.parse(this.responseText);
				Log.log(response);

				if(self.config.genera){
					var genera = self.pickLanguage(response.genera);
					if(genera){
						var pokeSubName = document.getElementById("poke-subname");
						pokeSubName.innerHTML = genera.genus
					}
				}

				// Get Translated Name and Flavor Text
				if(languageChosen){
					var nameObject = self.pickLanguage(response.names);
					if(nameObject){
						translatedName = nameObject.name;
						var pokeName = document.getElementById("poke-name");
						pokeName.innerHTML = translatedName.charAt(0).toUpperCase() + translatedName.slice(1) + " - #" + pokeNumber
					}

					var flavorTextDisplay = document.getElementById("flavor-text");
					// get first flavor text matching selected language
					var flavorTextObj = self.pickLanguage(response.flavor_text_entries);

					if (flavorTextDisplay && flavorTextObj) {
						// remove carriage returns, newlines, form-feeds for clean display
						var sanitizedText = flavorTextObj.flavor_text.replace(/\r\n/g, "")
						sanitizedText = sanitizedText.replace(/\f/g, " ")

						flavorTextDisplay.innerHTML = sanitizedText
					}
				}
			}
			self.markSeen(pokeNumber, translatedName || englishName, shiny, wrapper); //Also when the species request failed - the english name is enough then
		}

		httpRequest.onreadystatechange = function() {
			if(this.readyState == 4 && this.status == 200) {
				console.log(JSON.parse(this.responseText));
				var responsePokemon = JSON.parse(this.responseText);
				Log.log(responsePokemon);
				englishName = responsePokemon.name;
				shiny = shiny && !!responsePokemon.sprites.front_shiny; //No shiny picture - shown and noted as a normal pokemon
				languageHttpRequest.open("GET", languageApiURL, true);
				languageHttpRequest.send();


				self.createContent(responsePokemon, wrapper, shiny);
			} else {
				return "Loading...";
			}
		}
		httpRequest.open("GET", apiURL, true);
		httpRequest.send();
	},

	createContent: function(data, wrapper, shiny) { //Creates the elements for display
		var pokeWrapper = document.createElement("div");
		pokeWrapper.id = "poke-info";
		var flexWrapper = document.createElement("div");
		flexWrapper.id = "flex-wrapper";
		var pokeName = document.createElement("p");
		//TODO - maybe add an option to get rid of Pokedex #
		pokeName.innerHTML = data.name.charAt(0).toUpperCase() + data.name.slice(1) + " - #" + data.id;
		pokeName.id = "poke-name";

		if(this.config.gbaMode) pokeName.style.fontFamily = "'pokegb'";

		// Font size/style modification
		if(this.config.nameSize != 32) {
			if(this.config.gbaMode){
				pokeName.style.cssText = "font-size:" + this.config.nameSize + "px; font-family: 'pokegb';";
			} else {
				pokeName.style.cssText = "font-size:" + this.config.nameSize + "px;";
			}
		} else if(this.config.nameSize == 32) {//Changing default size if gbaMode is enabled without size changes added
			if(this.config.gbaMode){
				pokeName.style.cssText = "font-size: 22px; font-family: 'pokegb';";
			}
		}

		wrapper.appendChild(pokeName);

		if(this.config.genera){
			var pokeSubName = document.createElement("p");
			//TODO - maybe add an option to get rid of Pokedex #
			pokeSubName.id = "poke-subname";
			if(this.config.gbaMode) pokeSubName.style.cssText = "font-family: 'pokegb'";
			wrapper.appendChild(pokeSubName);
		}

		var pokePic = document.createElement("img");
		pokePic.src = shiny ? data.sprites.front_shiny : data.sprites.front_default;
		pokePic.id = "poke-pic";
		if(this.config.grayscale) {
			pokePic.id = "poke-pic-grayscale";
		}
		pokeWrapper.appendChild(pokePic);

		var types = document.createElement("div");
		types.id = "poke-types";
		var type1 = document.createElement("span");
		var type1Img = document.createElement("img");
		type1Img.src = "https://serebii.net/pokedex-dp/type/" + data.types[0].type.name + ".gif"
		if(this.config.grayscale){
			type1Img.id = "poke-pic-grayscale-type"
		} else {
			type1Img.id = "poke-pic-type"
		}
		type1.appendChild(type1Img);
		//type1.innerHTML = data.types[0].type.name.charAt(0).toUpperCase() + data.types[0].type.name.slice(1);
		types.appendChild(type1);
		if(data.types[1]){
			var type2 = document.createElement("span");
			var type2Img = document.createElement("img");
			if(this.config.grayscale){
				type2Img.id = "poke-pic-grayscale-type"
			} else {
				type2Img.id = "poke-pic-type"
			}
			type2Img.src = "https://serebii.net/pokedex-dp/type/" + data.types[1].type.name + ".gif"
			//type2.innerHTML = data.types[1].type.name.charAt(0).toUpperCase() + data.types[1].type.name.slice(1)
			type2.appendChild(type2Img);
			types.appendChild(type2);
		}
		pokeWrapper.appendChild(types);

		var badges = document.createElement("span"); //Top right of the pokemon: newSymbol, shinySymbol in the corner
		badges.id = "poke-badges";
		if(this.config.grayscale) badges.style.filter = "grayscale(100%)";
		var newBadge = document.createElement("span"); //Gets the newSymbol once node_helper.js reports the pokemon as new
		newBadge.id = "poke-new";
		badges.appendChild(newBadge);
		if(shiny && this.config.shinySymbol) badges.insertAdjacentHTML("beforeend", this.symbolHtml(this.config.shinySymbol));
		pokeWrapper.appendChild(badges);
		flexWrapper.appendChild(pokeWrapper);

		statWrapper = document.createElement("div");
		//TODO - Add in a stats table
		if(this.config.stats){
			var statTable = document.createElement("table");
			if(this.config.gbaMode) statTable.style.cssText = "font-family: 'pokegb'";

			["hp", "attack", "defense", "special-attack", "special-defense", "speed"].forEach(name => {//Fixed order - PokeAPI already changed the order of data.stats once
				let stat = data.stats.find(entry => entry.stat.name === name);
				if(!stat) return;
				let tr = document.createElement("tr");
				let tdName = document.createElement("td");
				let tdStat = document.createElement("td");
				tdName.innerHTML = this.translate(name);
				tdStat.innerHTML = stat.base_stat;
				tr.appendChild(tdName);
				tr.appendChild(tdStat);
				statTable.appendChild(tr);
			});

			statWrapper.appendChild(statTable);
			flexWrapper.appendChild(statWrapper);
		}
		wrapper.appendChild(flexWrapper);

		this.ratingsRow = document.createElement("div");//Filled by showRatings once the CSVs are loaded
		this.ratingsRow.id = "poke-ratings";
		if(this.config.grayscale) this.ratingsRow.style.filter = "grayscale(100%)";
		wrapper.appendChild(this.ratingsRow);
		this.showRatings();

		if (this.config.flavorText) {
			var flavorTextWrapper = document.createElement("div");
			flavorTextWrapper.id = "flavor-text-wrapper";

			var flavorText = document.createElement("p");
			flavorText.innerHTML = data.flavorTextDisplay ? data.flavorTextDisplay : "";
			flavorText.id = "flavor-text";

			flavorText.style.fontSize = "24px";
			flavorText.style.lineHeight = "1.5";
			if (this.config.gbaMode) {
				flavorText.style.fontFamily = "'pokegb'";
				flavorText.style.fontSize = "18px";
			}

			flavorTextWrapper.appendChild(flavorText);
			wrapper.appendChild(flavorTextWrapper);
		}
	},

	pickLanguage: function(entries) { //Entry in the configured language, english if there is none
		var language = this.config.language;
		return entries.find(entry => entry.language.name == language)
			|| entries.find(entry => entry.language.name == "en");
	},

	socketNotificationReceived: function(notification, payload) { //Messages from node_helper.js
		if(notification === "RATINGS_LOADED") {
			this.ratings = payload;
			this.showRatings();
		}
		if(notification === "NEXT_POKEMON") { //Command line: curl http://localhost:8080/MMM-DailyPokemon/next
			this.requestedNumber = payload.nr; //null = random
			this.requestedShiny = payload.shiny; //?shiny - for testing, also in grayscale
			this.updateDom(); //The timer keeps running, the next automatic change comes at the usual time
		}
		if(notification === "SET_INTERVAL") { //Command line: curl "http://localhost:8080/MMM-DailyPokemon/interval?time=12h"
			this.config.updateInterval = payload;
			this.startTimer(); //Counts from now, the current pokemon stays
		}
		if(notification === "SEEN_CHECKED" && this.seenRequests[payload.request]) { //Answers for other browsers showing the mirror are ignored
			var badge = this.seenRequests[payload.request].querySelector("#poke-new");
			delete this.seenRequests[payload.request];
			if(badge && payload.isNew && this.config.newSymbol) badge.innerHTML = this.symbolHtml(this.config.newSymbol);
		}
	},

	markSeen: function(nr, name, shiny, wrapper) { //node_helper.js notes the pokemon (and shinies) in already_seen.csv and answers whether it is new
		var request = nr + "-" + Math.random().toString(36).slice(2);
		this.seenRequests[request] = wrapper; //The answer goes to this pokemon, even if a newer one was rolled in between
		name = name || "";
		this.sendSocketNotification("MARK_SEEN", {
			folder: this.config.ratingsFolder,
			nr: nr,
			name: name.charAt(0).toUpperCase() + name.slice(1),
			shiny: !!shiny,
			request: request
		});
	},

	showRatings: function() { //Everyone who rated the current pokemon: 1 person centered, more spread from left to right
		if(!this.ratingsRow || !this.ratings) return;
		var self = this;
		this.ratingsRow.innerHTML = "";

		var people = this.ratings.filter(person => person.entries[self.pokeNumber]); //Only people with an entry take a place
		var rowCount = Math.ceil(people.length / Math.max(1, this.config.ratingsPerRow));
		var perRow = Math.ceil(people.length / rowCount); //Rows as even as possible, e.g. 5 people with 4 per row -> 3 + 2
		for(var start = 0; start < people.length; start += perRow) {
			var row = document.createElement("div");
			row.className = "poke-ratings-line";
			people.slice(start, start + perRow).forEach((person, index) => {
				if(index > 0) { //Takes the free space between two people (CSS), so all gaps are equal and the separator sits in the middle
					var separator = document.createElement("span");
					separator.className = "poke-rating-separator";
					separator.innerHTML = self.symbolHtml(self.config.ratingSeparator || "");
					row.appendChild(separator);
				}
				row.appendChild(self.personElement(person));
			});
			this.ratingsRow.appendChild(row);
		}
	},

	personElement: function(person) { //Label + rating symbol + team symbol of one person
		var entry = person.entries[this.pokeNumber];
		var symbols = [];
		if(entry.rating) symbols.push(this.ratingSymbol(entry.rating));
		if(entry.team) symbols.push(this.config.teamSymbol);

		var personSpan = document.createElement("span");
		personSpan.className = "poke-rating";
		var label = document.createElement("span");
		label.className = "poke-rating-label";
		label.innerHTML = person.label;
		if(this.config.gbaMode) label.style.fontFamily = "'pokegb'";
		personSpan.appendChild(label);
		personSpan.insertAdjacentHTML("beforeend", symbols.map(symbol => this.symbolHtml(symbol)).join(" "));
		return personSpan;
	},

	ratingSymbol: function(rating) { //Unknown values are shown as written, so typos are easy to spot
		var symbols = this.config.ratingSymbols;
		var key = Object.keys(symbols).find(value => value.toLowerCase() === rating.toLowerCase());
		return key ? symbols[key] : rating;
	},

	symbolHtml: function(symbol) { //Image files become a picture in text size (CSS .poke-rating-icon), everything else is shown as written
		if(!/\.(png|jpe?g|gif|svg|webp)$/i.test(symbol)) return symbol;
		var src = /^([a-z]+:|\/)/i.test(symbol) ? symbol : this.file(symbol); //"images/Pokeball.png" = file in the module folder, URLs stay as they are
		return "<img class=\"poke-rating-icon\" src=\"" + src + "\" alt=\"\">";
	},

	getStyles: function() {
		return [this.file('MMM-DailyPokemon.css')]
	},

	getTranslations: function() {
		return {
			en: "translations/en.json",
			de: "translations/de.json",
			fr: "translations/fr.json"
		}
	}
});
