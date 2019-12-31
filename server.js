require("./client.js")
const Connection = require('./modules/Connection.js');
const fs = require("fs");
const ws = require("ws");
const discord = require("discord.js");
const request = require("request");
const UpdateClock = require("./modules/UpdateClock.js")
const manager = require("./modules/manager.js")
var worlds = [];
var updateClock = new UpdateClock(worlds)
var bansIgnore = false;
var wss;
var config = require("./config.json");
var protocol = require("./modules/connection/protocol.js")
var captchaStates = require("./modules/captchaStates.js")
var worldTemplate = require("./modules/worldTemplate.js");
var bans = require("./bans.json")
var terminatedSocketServer = false;

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
		var connection = new Connection(ws, req, worlds, bans, manager, updateClock);
	});
}

function beginServer() {
	//loadDatabase()
	createWSServer()
	console.log("Server started. Type /help for help")
}
var rl = require("readline").createInterface({
	input: process.stdin,
	output: process.stdout
});
//server controler
if (process.platform === "win32") {
	rl.on("SIGINT", function() {
		process.emit("SIGINT");
	});
}
async function exit() {
	console.log("Exiting...");
	for (var w in worlds) {
		var world = worlds[w];
		for (var c = 0; c < world.clients.length; c++) {
			var client = world.clients[c];
			client.send(config.messages.closeMsg);
		}
	}
	await manager.close_database()
	process.exit()
}
process.on("SIGINT", exit)
process.on("beforeExit", exit);
var serverOpNick = "";
var serverOpRank = 3;
rl.on("line", function(d) {
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
			exit()
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
