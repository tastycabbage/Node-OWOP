const Connection = require('./modules/Connection.js');
const fs = require("fs");
const ws = require("ws");
const discord = require("discord.js");
const request = require("request");
const EventEmitter = require("events");


//server variables
var bansIgnore = false;
var wss;
var config = require("./config.json");

var protocol = require("./modules/connection/protocol.js")
var captchaStates = require("./modules/captchaStates.js")
var worldTemplate = require("./modules/worldTemplate.js");
var bans = require("./bans.json")
const manager = require("./modules/manager.js")

//public variables

var terminatedSocketServer = false;
var worlds = [];
var serverEvents = new EventEmitter();


function createWSServer() {
	wss = new ws.Server({
		port: config.port
	});
	wss.on("connection", function(ws, req) {
		if (terminatedSocketServer) {
			ws.send(config.closeMsg)
			ws.close();
		}
		/*if(ban.ip) {
			if(!ban.expires_at) {
				this.client.send("You got perm ban. Apeal for unban on: " + config.unbanLink)
				this.client.send("Reason: " + ban.reason)
				this.client.ws.close()
			} else {
				if(Date.now() < parseInt(ban.expires_at)) {
					let date = new Date(parseInt(ban.expires_at));
					this.client.send(`You are temp-banned.`)
					this.client.send(`It expires at ${date.getYear()}-${date.getMonth()}-${date.getDay()}-${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`)
					this.client.send("Apeal for unban on: " + config.unbanLink)
					this.client.send("Reason: " + ban.reason)
					this.client.ws.close()
				}
			}
		}*/

		if (config.captcha.enabled == true) {
			ws.send(new Uint8Array([protocol.server.captcha, captchaStates.waiting]))
		} else {
			ws.send(new Uint8Array([protocol.server.captcha, captchaStates.ok]))
		}

		var connection = new Connection(ws, req, worlds, bans, manager);
	});
}

function beginServer() {
	//loadDatabase()
	createWSServer()
	console.log("Server started. Type /help for help")
}

if (process.platform === "win32") {
  var rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

process.on("SIGINT", function () {
  //graceful shutdown
	console.log("Exiting...");
	for (var w in worlds) {
		var world = worlds[w];
		for (var c = 0; c < world.clients.length; c++) {
			var client = world.clients[c];
			client.send(config.messages.closeMsg);
		}
	}
	manager.close_database()
	process.exit()
});

//Server Controler
var stdin = process.openStdin();
var serverOpNick = "";
var serverOpRank = 3;
stdin.on("data", function(d) {
	var msg = d.toString().trim();
	if (terminatedSocketServer) return;
	if (msg.startsWith("/")) {
		var cmdCheck = msg.slice(1).split(" ");
		cmdCheck[0] = cmdCheck[0].toLowerCase();
		var argString = cmdCheck.slice(1).join(" ").trim();
		cmdCheck.filter(x => x);
		if (cmdCheck[0] == "help") {
			console.log("/help - Lists all commands.");
			console.log("/stop, /kill - Closes the server.");
			console.log("/js, /eval <code> - Evaluates the given code.");
			console.log("/nick <nick> - Changes your nick.");
			console.log("/rank <user|moderator|admin|server|tell|discord> - Changes your rank. (Only affects messages.)");
		} else if (cmdCheck[0] == "kill" || cmdCheck[0] == "stop") {
				console.log("Exiting...");
				for (var w in worlds) {
					var world = worlds[w];
					for (var c = 0; c < world.clients.length; c++) {
						var client = world.clients[c];
						client.send(config.messages.closeMsg);
					}
				}
				manager.close_database()
				process.exit()
		} else if (cmdCheck[0] == "eval" || cmdCheck[0] == "js") {
			try {
				console.log(String(eval(argString)));
			} catch (e) {
				console.log(e);
			}
		} else if (cmdCheck[0] == "nick") {
			serverOpNick = argString;
			if (argString) {
				console.log("Nickname set to: '" + argString + "'");
			} else {
				console.log("Nickname reset.");
			}
		} else if (cmdCheck[0] == "rank") {
			var rankIndex = ["user", "moderator", "admin", "server", "tell", "discord"].indexOf(cmdCheck[1].toLowerCase())
			if (~rankIndex) {
				serverOpRank = rankIndex;
				console.log("Set rank to " + cmdCheck[1].toLowerCase() + ".");
			} else {
				console.log("Usage: /rank <user|moderator|admin|server|tell|discord>")
			}
		}
	} else {
		function sendToWorlds(msg) {
			for (var gw in worlds) {
				var worldCurrent = worlds[gw];
				var clientsOfWorld = worldCurrent.clients;
				for (var s = 0; s < clientsOfWorld.length; s++) {
					var sendToClient = clientsOfWorld[s].send;
					sendToClient(msg);
				}
			}
		}
		sendToWorlds((serverOpNick && ["[0] ", "", " ", "[Server] "][serverOpRank] || ["", "(M) ", "(A) ", "Server", "-> ", "[D] "][serverOpRank]).trimLeft() + (serverOpNick || (serverOpRank == 3 ? "" : "0")) + ": " + msg);
	}
});
beginServer()
