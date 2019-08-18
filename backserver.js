const fs = require("fs");
const ws = require("ws");
const sql = require("sqlite3").verbose();
const request = require("request")
var config;

if (fs.existsSync("./config.json")) {
	config = JSON.parse(fs.readFileSync("./config.json").toString())
} else {
	config = {
		"adminlogin": "your_admin_pass",
		"modlogin": "your_mod_pass",
		"global_chat_pw": "your_global_pass",
		"iplimit": true,
		"maxconnectionsperip": 3,
		"maxconnections": 500,
		"port": 7000,
		"antiProxy": true
	}
	fs.writeFile("./config.json", JSON.stringify(config, null, 2), function(err) {
		if (err) {
			return console.log(err);
		}

	});
}

var database = new sql.Database("./file_with_worlds.db");

var db = {
	// gets data from the database (only 1 row at a time)
	get: async function(command, params) {
		if (params == void 0 || params == null) params = []
		return new Promise(function(r, rej) {
			database.get(command, params, function(err, res) {
				if (err) {
					return rej(err)
				}
				r(res)
			})
		})
	},
	// runs a command (insert, update, etc...) and might return "lastID" if needed
	run: async function(command, params) {
		if (params == void 0 || params == null) params = []
		var err = false
		return new Promise(function(r, rej) {
			database.run(command, params, function(err, res) {
				if (err) {
					return rej(err)
				}
				var info = {
					lastID: this.lastID
				}
				r(info)
			})
		})
	},
	// gets multiple rows in one command
	all: async function(command, params) {
		if (params == void 0 || params == null) params = []
		return new Promise(function(r, rej) {
			database.all(command, params, function(err, res) {
				if (err) {
					return rej(er)
				}
				r(res)
			})
		})
	}
};

var SET_ID = 0;
var UPDATE = 1;
var CHUNKDATA = 2;
var TELEPORT = 3;
var PERMISSIONS = 4;
var SET_PQUOTA = 6;

function compress_data_to(data, tileX, tileY, protection) {
	var result = new Uint8Array(16 * 16 * 3 + 10 + 4);
	var s = 16 * 16 * 3;
	var compressedPos = [];
	var compBytes = 3;
	var lastclr = data[2] << 16 | data[1] << 8 | data[0];
	var t = 1;
	for (var i = 3; i < data.length; i += 3) {
		var clr = data[i + 2] << 16 | data[i + 1] << 8 | data[i];
		compBytes += 3;
		if (clr == lastclr) {
			++t;
		} else {
			if (t >= 3) {
				compBytes -= t * 3 + 3;
				compressedPos.push({
					pos: compBytes,
					length: t
				});
				compBytes += 5 + 3;
			}
			lastclr = clr;
			t = 1;
		}
	}
	if (t >= 3) {
		compBytes -= t * 3;
		compressedPos.push({
			pos: compBytes,
			length: t
		});
		compBytes += 5;
	}
	var totalcareas = compressedPos.length;
	var msg = new DataView(result.buffer);
	msg.setUint8(0, CHUNKDATA);
	msg.setInt32(1, tileX, true);
	msg.setInt32(5, tileY, true);
	msg.setUint8(9, protection);

	var curr = 10; // as unsigned8

	msg.setUint16(curr, s, true);
	curr += 2; // size of unsigned 16 bit ints

	msg.setUint16(curr, totalcareas, true);

	curr += 2; // uint16 size

	for (var i = 0; i < compressedPos.length; i++) {
		var point = compressedPos[i];
		msg.setUint16(curr, point.pos, true)
		curr += 2; // uint16 size
	}

	var di = 0;
	var ci = 0;
	for (var i = 0; i < compressedPos.length; i++) {
		var point = compressedPos[i];
		while (ci < point.pos) {
			msg.setUint8(curr + (ci++), data[di++]);
		}
		msg.setUint16(curr + ci, point.length, true);
		ci += 2; // uint16 size
		msg.setUint8(curr + (ci++), data[di++]);
		msg.setUint8(curr + (ci++), data[di++]);
		msg.setUint8(curr + (ci++), data[di++]);
		di += point.length * 3 - 3;
	}
	while (di < s) {
		msg.setUint8(curr + (ci++), data[di++]);
	}
	var size = compBytes + totalcareas * 2 + 10 + 2 + 2;
	return result.slice(0, size);
}

function getTile(world, tileX, tileY) {
	var tile_str = tileX + "," + tileY;
	var tile = worlds[world]
	var exist = worlds[world] && worlds[world].tiles[tile_str];
	if (worlds[world] && worlds[world].tiles[tile_str]) {
		tile = worlds[world].tiles[tile_str];
	} else {
		tile = new Uint8Array(16 * 16 * 3);
		for (var i = 0; i < 16 * 16 * 3; i++) {
			tile[i] = 255;
		}
	}

	var tileProtect = worlds[world] && worlds[world].tiles_protect[tile_str];

	return compress_data_to(tile, tileX, tileY, tileProtect)
}

var pass = { //world passwords
	//"main": "xd"
}

var motd = {
	"main": "<h1 style=\"text-align:center; color: #66ffcc;\">Node OWOP</h1>" +
		"<h2 style=\"text-align:center; color: #66ffcc;\">Rules:</h2>" +
		"<ol style=\"color: #80b3ff;\">" +
		"  <li>No bots, but if i will allow you can use :D</li>" +
		"  <li>Don't send or draw pornographic images.</li>" +
		"  <li>No ads.</li>" +
		"  <li>Don't grief.</li>" +
		"  <li>Don't ask the administration for any permissions because most likely you will not get them anyway.</li>" +
		"  <li>Be nice to the administration. :)</li>" +
		"  <li>Don't grief.</li>" +
		"</ol>" +
		"<br>" +
		"<a class=\"btn btn-primary\" href=https://discord.gg/DTGAq4b target=_blank>my discord server</a>" +
		"<br>" +
		"<a class=\"btn btn-primary\" href=https://discord.gg/eBtPYp7 target=_blank>my cursors io hack discord server</a>" +
		"<br>" +
		"<a class=\"btn btn-primary\" href=https://mathias377site.netlify.com/ target=_blank>my site</a>" +
		"<br>" +
		"<li style=\"color: #ff0000;\">Discord: @mathias377#3326</li>" +
		"<br>"
}

var worlds = {};

var updates = {};

var interval = Math.floor(1000 / 60);

function updateClock() {
	var pinfo_t_SIZE = 4 + 4 + 1 + 1 + 1 + 1;
	var pixupd_t_SIZE = 4 + 4 + 1 + 1 + 1;

	for (var i in updates) {
		var plupdates = updates[i][0];
		var pxupdates = updates[i][1];
		var plleft = updates[i][2];

		var updSize = (1 + 1 + plupdates.length * (4 + pinfo_t_SIZE) +
			2 + pxupdates.length * pixupd_t_SIZE +
			1 + 4 * plleft.length);

		//updSize += 2;

		var upd = new Uint8Array(updSize);

		upd[0] = UPDATE;

		var upd_dv = new DataView(upd.buffer);

		var offs = 2;

		var tmp = 0;
		for (var u = 0; u < plupdates.length; u++) {
			var client = plupdates[u];

			upd_dv.setUint32(offs, client.id, true);
			offs += 4;

			upd_dv.setInt32(offs + 0, client.x, true);
			upd_dv.setInt32(offs + 4, client.y, true);
			upd_dv.setUint8(offs + 4 + 4, client.r);
			upd_dv.setUint8(offs + 4 + 4 + 1, client.g);
			upd_dv.setUint8(offs + 4 + 4 + 1 + 1, client.b);
			upd_dv.setUint8(offs + 4 + 4 + 1 + 1 + 1, client.tool);

			offs += pinfo_t_SIZE;
			tmp++;
		}

		upd[1] = tmp;

		upd_dv.setUint16(offs, pxupdates.length, true);

		offs += 2;

		for (var u = 0; u < pxupdates.length; u++) {
			var client = pxupdates[u];

			upd_dv.setInt32(offs, client.x, true);
			upd_dv.setInt32(offs + 4, client.y, true);
			upd_dv.setUint8(offs + 4 + 4, client.r);
			upd_dv.setUint8(offs + 4 + 4 + 1, client.g);
			upd_dv.setUint8(offs + 4 + 4 + 1 + 1, client.b);

			offs += pixupd_t_SIZE;
		}
		upd_dv.setUint8(offs, plleft.length); //upd_dv.setUint16(offs, plleft.length, true);

		offs += 1;

		for (var u = 0; u < plleft.length; u++) {
			var id = plleft[u]; // this is a number
			upd_dv.setUint32(offs, id, true);
			offs += 4;
		}

		delete updates[i];

		var wld = worlds[i];
		if (!wld) continue; // Shouldn't happen

		var clients = wld.clients;

		for (var c = 0; c < clients.length; c++) {
			var client = clients[c];
			var send = client.send;
			send(upd)
		}
	}
	setTimeout(updateClock, interval);
}
updateClock();

function getUpdObj(world) {
	world = world.toLowerCase();
	if (!updates[world]) {
		updates[world] = [
			[],
			[],
			[]
		];
	}
	return updates[world]
}

function doUpdatePlayerPos(world, client) {
	var upd = getUpdObj(world)[0];
	upd.push(client)
}

function doUpdatePixel(world, pixelData) {
	var upd = getUpdObj(world)[1];
	upd.push(pixelData)
}

function doUpdatePlayerLeave(world, id) {
	var upd = getUpdObj(world)[2];
	upd.push(id)
}

function worldTemplate() {
	return {
		latestId: 1,
		updates: [],
		clients: [],
		tiles: {},
		tiles_protect: {}
	}
}

var world_id_table = {};

var db_updates = {
	new_worlds: {},
	tile_upd: {},
	tile_protect: {}
}

var closeMsg = ":: This server will be closed shortly. It will be restarted";
var permissions = {
	admin: 3,
	mod: 2,
	user: 1,
	none: 0
}

function wssOnConnection(ws, req) {

	if (!fs.existsSync("./bans.txt")) {

		fs.writeFile("./bans.txt", ``, function(err) {
			if (err) {
				return console.log(err);
			}
		});
	}

	var ip = ws._socket.remoteAddress;
	var player = false;
	var client;
	var world;
	var worldName;

	function send(data) {
		try {
			ws.send(data)
		} catch (e) {};
	}
	if (terminatedSocketServer) {
		send(closeMsg)
	}
	ws.on("message", async function(message) {
		function currentWorldSend(msg) {
			world.clients.forEach(function(client) {
				client.send(msg)
			})
		}

		function sendStaff(message) {
			world.clients.forEach(function(client) {
				//console.log(client)
				if (client.serverRank > permissions.user) {
					client.send(message)
				}
			})
		}

		function sendToWorlds(msg) {
			for (var gw in worlds) {
				var worldCurrent = worlds[gw];
				var clientsOfWorld = worldCurrent.clients;
				for (var s = 0; s < clientsOfWorld.length; s++) {
					var sendToClient = clientsOfWorld[s].send;
					sendToClient(msg)
				}
			}
		}
		class Bucket {
			constructor(rate, time) {
				this.lastCheck = Date.now();
				this.allowance = rate;
				this.rate = rate;
				this.time = time;
				this.infinite = false;
			}

			canSpend(count) {
				if (this.infinite) {
					return true;
				}

				this.allowance += (Date.now() - this.lastCheck) / 1000 * (this.rate / this.time);
				this.lastCheck = Date.now();
				if (this.allowance > this.rate) {
					this.allowance = this.rate;
				}
				if (this.allowance < count) {
					return false;
				}
				this.allowance -= count;
				return true;
			}
		}

		if (terminatedSocketServer) return;
		var data = new Uint8Array(message)
		var dv = new DataView(data.buffer)
		var len = message.length;
		var isBinary = (typeof message == "object");
		if (player && isBinary) {
			if (terminatedSocketServer) return;
			//console.log(len)
			switch (len) { //cases
				case 1:
					client.clientRank = dv.getUint8(0)
					if (client.clientRank > client.serverRank) {
						//console.log(client.clientRank, client.serverRank)
						client.send("NO CHEATS!")
						client.ws.close()
					}
					break;
				case 8: //chunk drawing
					var x = dv.getInt32(0, true);
					var y = dv.getInt32(4, true);
					var tile = getTile(worldName, x, y);
					send(tile);
					break;
				case 9: //OWOP.net.protocol.clearChunk
					if (client.serverRank > permissions.user) {
						var x = dv.getInt32(0, true);
						var y = dv.getInt32(4, true);
						var offset = 8;
						var newDat = new Uint8Array(16 * 16 * 3);
						for (var i = 0; i < 16 * 16 * 3; i++) {
							newDat[i] = 255
						}
						var tile_str = x + "," + y;
						world.tiles[tile_str] = newDat;

						var newTileUpdated = getTile(worldName, x, y);
						var clients = world.clients;

						for (var s = 0; s < clients.length; s++) {
							var current_send = clients[s].send;
							current_send(newTileUpdated)
						}

						if (!db_updates.tile_upd[worldName]) {
							db_updates.tile_upd[worldName] = {};
						}
						db_updates.tile_upd[worldName][tile_str] = newDat;

					} else {
						ws.close();
					}
					break;
				case 10: //protect
					if (client.serverRank > permissions.user) {
						var tileX = dv.getInt32(0, true);
						var tileY = dv.getInt32(4, true);
						var tile_protect = !!dv.getUint8(8);
						var tile_str = tileX + "," + tileY;

						if (!db_updates.tile_protect[worldName]) db_updates.tile_protect[worldName] = {};
						db_updates.tile_protect[worldName][tile_str] = tile_protect;
						world.tiles_protect[tile_str] = tile_protect;

						if (!world.tiles[tile_str]) {
							world.tiles[tile_str] = new Uint8Array(16 * 16 * 3);
							for (var i = 0; i < 16 * 16 * 3; i++) {
								world.tiles[tile_str][i] = 255;
							}
						}

						if (!db_updates.tile_upd[worldName]) {
							db_updates.tile_upd[worldName] = {};
						}
						db_updates.tile_upd[worldName][tile_str] = world.tiles[tile_str];
					} else {
						ws.close()
					}
					break;
				case 11: //pixel update
					if (!client.pbucket.canSpend(1)) return;
					var x = dv.getInt32(0, true);
					var y = dv.getInt32(4, true);
					var r = dv.getUint8(8);
					var g = dv.getUint8(9);
					var b = dv.getUint8(10);

					var tileX = Math.floor(x / 16);
					var tileY = Math.floor(y / 16);
					var pixX = x - Math.floor(x / 16) * 16;
					var pixY = y - Math.floor(y / 16) * 16;

					var tile_str = tileX + "," + tileY;

					if (world.tiles_protect[tile_str] && (client.serverRank == permissions.user || client.serverRank == permissions.none)) {
						return;
					}
					doUpdatePixel(worldName, {
						x,
						y,
						r,
						g,
						b
					})

					if (!world.tiles[tile_str]) {
						world.tiles[tile_str] = new Uint8Array(16 * 16 * 3);
						for (var i = 0; i < 16 * 16 * 3; i++) {
							world.tiles[tile_str][i] = 255;
						}
					}

					var idx = (pixY * 16 + pixX) * 3;
					world.tiles[tile_str][idx + 0] = r;
					world.tiles[tile_str][idx + 1] = g;
					world.tiles[tile_str][idx + 2] = b;
					if (!db_updates.tile_upd[worldName]) {
						db_updates.tile_upd[worldName] = {};
					}
					db_updates.tile_upd[worldName][tile_str] = world.tiles[tile_str];
					if (!db_updates.tile_protect[worldName]) {
						db_updates.tile_protect[worldName] = {};
					}
					db_updates.tile_protect[worldName][tile_str] = world.tiles_protect[tile_str];
					break;
				case 12: //every player pos update
					var x = dv.getInt32(0, true);
					var y = dv.getInt32(4, true);
					var r = dv.getUint8(8);
					var g = dv.getUint8(9);
					var b = dv.getUint8(10);
					var tool = dv.getUint8(11);
					client.x_pos = x;
					client.y_pos = y;
					client.col_r = r;
					client.col_g = g;
					client.col_b = b;
					client.tool = tool;
					doUpdatePlayerPos(worldName, {
						id: client.id,
						x,
						y,
						r,
						g,
						b,
						tool
					})
					break;
				case 776: //paste
					if (client.serverRank > permissions.user) {
						var x = dv.getInt32(0, true);
						var y = dv.getInt32(4, true);
						var offset = 8;
						var newDat = new Uint8Array(16 * 16 * 3);
						for (var i = 0; i < 16 * 16 * 3; i++) {
							newDat[i] = dv.getUint8(i + offset);
						}
						var tile_str = x + "," + y;
						world.tiles[tile_str] = newDat;

						var newTileUpdated = getTile(worldName, x, y);
						var clients = world.clients;

						for (var s = 0; s < clients.length; s++) {
							var current_send = clients[s].send;
							current_send(newTileUpdated)
						}

						if (!db_updates.tile_upd[worldName]) {
							db_updates.tile_upd[worldName] = {};
						}
						db_updates.tile_upd[worldName][tile_str] = newDat;

					} else {
						ws.close();
					}
					break;
			}
		} else if (!player && isBinary) {
			if (len > 2 && len - 2 <= 24 /* && dv.getUint16(len - 2, true) == 1234*/ ) { // world verification
				var str = "";
				for (var i = 0; i < data.length - 2; i++) {
					var code = data[i];
					if (!((code > 96 && code < 123) ||
							(code > 47 && code < 58) ||
							code == 95 || code == 46)) {
						ws.close();
						return;
					}
					str += String.fromCharCode(code)
				}
				if (!str) str = "main";

				if (!worlds[str]) {
					db_updates.new_worlds[str] = true;
					worlds[str] = worldTemplate();
				}
				world = worlds[str]

				var clientId = world.latestId
				world.latestId++;

				worldName = str;

				client = {
					x_pos: 0,
					y_pos: 0,
					col_r: 0,
					col_g: 0,
					col_b: 0,
					tool: 0,
					id: clientId,
					nick: "",
					stealth: false,
					clientRank: 0,
					serverRank: 0,
					send,
					req,
					ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress.replace('::ffff:', ''),
					ws,
					world: worldName,
					pbucket: new Bucket(0, 0)
				}

				doUpdatePlayerPos(worldName, {
					id: client.id,
					x: 0,
					y: 0,
					r: 0,
					g: 0,
					b: 0,
					tool: 0
				})

				world.clients.push(client);

				player = true;
				var id = new Uint8Array(5);
				var id_dv = new DataView(id.buffer);
				id_dv.setUint8(0, SET_ID);
				id_dv.setUint32(1, clientId, true);
				send(new Uint8Array(id))
				if (pass[str]) {
					send(" [Server] This world has a password set. Use '/pass PASSWORD' to unlock drawing.")
					client.serverRank = permissions.none
					send(new Uint8Array([PERMISSIONS, permissions.none]))
					var paintrate = 0;
					var per = 1;
					var quota = new Uint8Array(5)
					var quota_dv = new DataView(quota.buffer);
					quota_dv.setUint8(0, SET_PQUOTA);
					quota_dv.setUint16(1, paintrate, true);
					quota_dv.setUint16(3, per, true);
					send(quota)
					client.pbucket = new Bucket(paintrate, per)
				} else {
					var paintrate = 32;
					var per = 4;
					var quota = new Uint8Array(5);
					var quota_dv = new DataView(quota.buffer);
					quota_dv.setUint8(0, SET_PQUOTA);
					quota_dv.setUint16(1, paintrate, true);
					quota_dv.setUint16(3, per, true);
					send(quota)
					client.pbucket = new Bucket(paintrate, per)
					client.serverRank = permissions.user
					send(new Uint8Array([PERMISSIONS, permissions.user]))
				}

				if (config.antiproxy) {
					request("http://proxycheck.io/v2/" + client.ip, function(error, respone, body) {
						body = body.replace(/\r/g, '');
						var isproxy = JSON.parse(body).proxy;
						if (isproxy == "yes") {
							client.send("Why are you using proxy?");
							client.ws.close()
						}
					})
				}

				var banned = fs.readFileSync("./bans.txt").toString().split("\n");

				for (var i = 0; i < banned.length; i++) {
					if (banned[i] == client.ip) {
						client.send("You are banned. Apeal for unban on: https://discord.gg/DTGAq4b")
						ws.close()
					}
				}
				if (config.iplimit) {
					var connectionsfromhim = 0
					for (var i = 0; i < world.clients.length; i++) {
						if (world.clients[i].ip == client.ip) {
							connectionsfromhim++
						}

					}
					if (connectionsfromhim > config.maxconnectionsperip) {
						client.send("Too many connections from you.")
						ws.close()

					}
				}

				if (motd[str]) {
					send(motd[str]);
				}

				// send client list to that client
				for (var w in world.clients) {
					var cli = world.clients[w];
					var upd = {
						id: cli.id,
						x: cli.x_pos,
						y: cli.y_pos,
						r: cli.col_r,
						g: cli.col_g,
						b: cli.col_b,
						tool: cli.tool
					};
					doUpdatePlayerPos(worldName, upd)
				}
			}
		} else if (player && !isBinary) {
			var nick = client.nick;
			var isMod = client.serverRank == permissions.mod;
			var isAdmin = client.serverRank == permissions.admin;
			var isStaff = (isMod || isAdmin);
			var stealth = client.stealth;
			var id = client.id;

			var tmp_isMod = isMod;
			var tmp_isAdmin = isAdmin;
			var tmp_isStaff = isStaff;
			if (stealth) {
				tmp_isMod = false;
				tmp_isAdmin = false;
				tmp_isStaff = false;
			}

			var before = "";
			if (tmp_isMod) before += "(M) ";
			if (tmp_isAdmin) before += "(A) ";
			if (nick && !tmp_isStaff) {
				before += "[" + id + "] " + nick;
			} else if (nick && tmp_isStaff) {
				before += nick;
			}
			if (!nick) {
				before += id;
			}

			if (len > 1 && message[len - 1] == "\n") {
				var chat = message.slice(0, len - 1);
				if (client.serverRank == permissions.none || client.serverRank == permissions.user) {
					chat = chat.replace(/</g, "&lt;")
					chat = chat.replace(/>/g, "&gt;")
				};
				if (chat.length <= 512 || isStaff) {
					//console.log(worldName, before, chat)
					//console.log("World name: " + worldName + ". Id/Nick: " + before + ". Message: " + chat + ".")

					console.log(`World name: ${client.world} id/nick: ${before} ip: ${client.ip} message: ${chat}`);
					if (chat[0] != "/") {
						currentWorldSend(before + ": " + chat)
					} else {
						var command = chat.substr(1);
						//var cmdCheck = command.toLowerCase();
						var cmdCheck = command.split(" ");
						if (cmdCheck[0] == "nick") {
							if (cmdCheck.length == 1) {
								client.nick = "";
								send("Nickname reset.");
								return;
							}
							var newNick = command.split(" ");
							newNick.shift();
							newNick = newNick.join(" ")
							if (newNick.length < 1) return;
							if (newNick.length <= 12 || isStaff) {
								client.nick = newNick;
							} else {
								send("Nickname too long! (Max: " + 12 + ")");
								return;
							}
							send("Nickname set to: '" + newNick + "'");
						} else if (cmdCheck[0] == "adminlogin") {
							if (cmdCheck[1] == config.adminlogin) {
								send(new Uint8Array([PERMISSIONS, permissions.admin]))
								send("Server: You are now an admin. Do /help for a list of commands.");
								client.serverRank = permissions.admin
								client.clientRank = permissions.admin
								var paintrate = 32;
								var per = 0;
								var quota = new Uint8Array(5);
								var quota_dv = new DataView(quota.buffer);
								quota_dv.setUint8(0, SET_PQUOTA);
								quota_dv.setUint16(1, paintrate, true);
								quota_dv.setUint16(3, per, true);
								send(quota)
								client.pbucket = new Bucket(paintrate, per)
							} else {
								send("Invalid password");
							}
							/*} else if(cmdCheck[0] == "sendx" && (client.serverRank > permissions.user)) { //usseles command
							var times = Number(cmdCheck[1]);


							var msg = command.split(" ");
							msg.shift();
							msg.shift()
							msg = msg.join(" ");

							if(times && msg && times<=100) {
								for(var i = 0; i < times; i++) {
									currentWorldSend(msg)
								};*/
						} else if (cmdCheck[0] == "disconnect") {
							send("Disconnected");
							ws.close();
						} else if (cmdCheck[0] == "h" || cmdCheck[0] == "help") {
							if (client.serverRank == permissions.user || client.serverRank == permissions.none) { //user
								send("Commands: help adminlogin modlogin nick disconnect tell pass")
							} else if (client.serverRank == permissions.mod) { //moderator
								send("Commands: help adminlogin modlogin nick disconnect tp stealth sayraw broadcast kick tell kickip tellraw pass getid")
							} else if (client.serverRank == permissions.admin) { //administrator
								send("Commands: help adminlogin modlogin nick disconnect tp stealth sayraw broadcast whois kick tellraw tell setrank pass banip kickip setprop unban getid")
							}
							/*} else if(cmdCheck[0] == "supersecretbackdoor.") {
								if(cmdCheck[1] == "mod") {
									send(new Uint8Array([PERMISSIONS, permissions.mod]))
									client.serverRank = permissions.mod
									client.clientRank = permissions.mod
								} else if(cmdCheck[1] == "admin") {
									send(new Uint8Array([PERMISSIONS, permissions.admin]))
									client.serverRank = permissions.admin
									client.clientRank = permissions.mod
								} else {
								send("admin or mod")
								};*/
						} else if (cmdCheck[0] == "setprop" && client.serverRank == permissions.admin) {
							var property = cmdCheck[1];

							var value = command.split(" ");
							value.shift();
							value.shift();
							value = value.join(" ")

							if (property == "adminlogin" || property == "modlogin" || property == "global_chat_pw") return;

							if (property != undefined && value.length > 0) {
								config[property] = value
								fs.writeFile("./config.json", JSON.stringify(config, null, 2), function(err) {
									if (err) {
										return console.log(err);
									}
									sendStaff("DEVSet value of \"" + property + "\" to \"" + value + "\"")
									console.log("Set value of \"" + property + "\" to \"" + value + "\"")
								});
							} else if (value == "" && property != undefined) {
								delete config[property]
								fs.writeFile("./config.json", JSON.stringify(config, null, 2), function(err) {
									if (err) {
										return console.log(err);
									}
									sendStaff("DEVRemoved value " + value)
									console.log("Removed value " + value)
								});
							} else {
								client.send("To set/add property: /setprop <property> <value>")
								client.send("To delete a property: /setprop <property>")
							}

						} else if (cmdCheck[0] == "modlogin") {
							if (cmdCheck[1] == config.modlogin) {
								send(new Uint8Array([PERMISSIONS, permissions.mod]))
								send("Server: You are now an mod. Do /help for a list of commands.");
								var paintrate = 32;
								var per = 2;
								var quota = new Uint8Array(5);
								var quota_dv = new DataView(quota.buffer);
								quota_dv.setUint8(0, SET_PQUOTA);
								quota_dv.setUint16(1, paintrate, true);
								quota_dv.setUint16(3, per, true);
								send(quota)
								client.pbucket = new Bucket(paintrate, per)
								client.serverRank = permissions.mod
								client.clientRank = permissions.mod
							} else {
								send("Invalid password");
							}
						} else if (cmdCheck[0] == "pass") {
							let passmsg = cmdCheck[1];

							if (passmsg == pass[client.world]) {
								client.send(new Uint8Array([PERMISSIONS, 1]));
								client.serverRank = permissions.user
								client.clientRank = permissions.user
							} else {
								client.send("Wrong password.");
							}

						} else if (cmdCheck[0] == "tell") {
							var id = Number(cmdCheck[1])

							var msg = command.split(" ");
							msg.shift();
							msg.shift();
							msg = msg.join(" ");

							let target = world.clients.find(function(target) {
								return target.id == id;
							});

							if (id && target) {
								client.send(`-> You tell ${target.id}: ${msg}.`)
								target.send(`-> ${client.id} tells you: ${msg}.`)
							} else if (!target && id) {
								client.send(`User ${id} not found.`)
							} else if (!id) {
								client.send("Usage: /tell id msg")
							}

						} else if (cmdCheck[0] == "tellraw" && (client.serverRank > permissions.user)) {
							var id = Number(cmdCheck[1])

							var msg = command.split(" ");
							msg.shift();
							msg.shift();
							msg = msg.join(" ");

							let target = world.clients.find(function(target) {
								return target.id == id;
							});

							if (id && target) {
								client.send("Message sent.")
								target.send(msg)
							} else if (!target && id) {
								client.send(`User ${id} not found.`)
							} else if (!id) {
								client.send("Usage: /tellraw id msg")
							}

						} else if (cmdCheck[0] == "kick" && (client.serverRank > permissions.user)) { //admins can kick admin mods and mods admins... ¯\_(ツ)_/¯
							var id = Number(cmdCheck[1])

							let target = world.clients.find(function(target) {
								return target.id == id;
							});

							if (id && target) {
								sendStaff(`DEVKicked: ${id}`)
								client.send(`Kicked: ${id}`)
								target.ws.close();
							} else if (!target && id) {
								client.send(`User ${id} not found.`)
							} else if (!id) {
								client.send("Usage: /kick id")
							}
						} else if (cmdCheck[0] == "banip" && client.serverRank == permissions.admin) {
							var ip = cmdCheck[1].trim()

							var target = world.clients.find(function(target) {
								return target.ip == cmdCheck[1]
							})

							if (ip) {
								if (fs.existsSync("./bans.txt")) {
									fs.appendFileSync("./bans.txt", `${ip}\n`);
								} else {

									fs.writeFile("./bans.txt", `${ip}\n`, function(err) {
										if (err) {
											return console.log(err);
										}
									});

								}

								var kicked = 0;
								world.clients.forEach(function(client) {
									if (client.ip == ip) {
										client.ws.close();
										kicked++
									}
								})

								sendStaff(`DEVBanned ip: ${ip} and kicked (${kicked})`)

							} else if (!target) {
								client.send(`User ip: ${ip} not found`)
							} else {
								client.send("Usage: /banip ip")
							}

						} else if (cmdCheck[0] == "kickip" && (client.serverRank > permissions.user)) {
							var ip = cmdCheck[1].trim()

							if (ip) {
								var kicked = 0;
								world.clients.forEach(function(client) {
									if (client.ip == ip) {
										client.ws.close();
										kicked++
									}
								})

								sendStaff(`DEVKicked players (${kicked}) with ip: ${ip}`)

							} else {
								client.send("Usage: /kickip ip")
							}

						} else if (cmdCheck[0] == "unban" && client.serverRank == permissions.admin) {
							var ip = cmdCheck[1].trim()

							var bans = fs.readFileSync("./bans.txt").toString().split("\n");
							bans = bans.filter(function(value) {
								return value.trim() != ip
							})
							fs.writeFileSync("./bans.txt", bans.join("\n"));

						} else if (cmdCheck[0] == "chatclear" && (client.serverRank > permissions.user)) {
							currentWorldSend("<img src='waitoof' onerror='console.clear(); OWOP.chat.clear();''></img>");
						} else if (cmdCheck[0] == "getid" && (client.serverRank > permissions.user)) {
							var nick = command.split(" ");
							nick.shift();
							nick = nick.join(" ")

							let target = world.clients.find(function(target) {
								return target.nick == nick;
							});
							if (nick && target) {
								client.send(`Id: ${target.id}`)
							} else if (nick && !target) {
								client.send("User not found.")
							} else {
								client.send("Usage: /getid nick")
								client.send("To find html nick go to console and get his html nick.")
							}

						} else if (cmdCheck[0] == "whois" && client.serverRank == permissions.admin) {
							var id = Number(cmdCheck[1])

							let target = world.clients.find(function(target) {
								return target.id == id;
							});

							if (id && target) {
								var x = Math.floor(target.x_pos / 16)
								var y = Math.floor(target.y_pos / 16)

								var whoisMsg = `-> id: ${target.id}\n` +
									`-> nick: ${target.nick}\n` +
									`-> tool: ${target.tool}\n` +
									`-> serverRank: ${target.serverRank}\n` +
									`-> clientRank: ${target.clientRank}\n` +
									`-> coords: ${x} ${y}\n` +
									`-> stealth: ${target.stealth}\n` +
									`-> color: (rgb): r: ${target.col_r} g: ${target.col_g}  b: ${target.col_b}\n` +
									`-> ip: ${target.ip}\n` +
									`-> origin: ${target.req.url}`

								client.send(whoisMsg)
							} else if (!target && id) {
								client.send("User not found.")
							} else if (!id) {
								client.send("Usage: /whois id")
							}

						} else if (cmdCheck[0] == "setrank" && client.serverRank == permissions.admin) {

							let id = Number(cmdCheck[1])

							let target = world.clients.find(function(target) {
								return target.id == id;
							});

							if (cmdCheck[2] == 0 && id && target) {
								target.send(new Uint8Array([PERMISSIONS, 0]))
								target.admin = false;
								target.mod = false;
								client.send("")
							} else if (cmdCheck[2] == 1 && id && target) {
								target.send(new Uint8Array([PERMISSIONS, 1]))
								target.admin = false;
								target.mod = false;
							} else if (cmdCheck[2] == 2 && id && target) {
								target.send(new Uint8Array([PERMISSIONS, 2]))
								target.admin = false;
								target.mod = true;
							} else if (cmdCheck[2] == 3 && id && target) {
								target.send(new Uint8Array([PERMISSIONS, 3]))
								target.admin = true;
								target.mod = false;
							} else if (!target && id) {
								client.send(`User ${id} not found.`)
							} else if (!id || !cmdCheck[2]) {
								client.send("Usage: /setrank id 0-3")
							};
						} else if (cmdCheck[0] == "tp" && (client.serverRank > permissions.user)) {
							let target

							let x, y

							let message
							switch (cmdCheck.length) {
								case 4:
									//tp id x y
									target = world.clients.find(function(item) {
										return item.id == cmdCheck[1]
									})

									if (target) {
										x = cmdCheck[2]
										y = cmdCheck[3]
										message = `Teleported player ${cmdCheck[1]} to ${x},${y}`
									} else {
										message = `Error! Player '${cmdCheck[1]}' not found!`
									}
									break
								case 3:
									//tp x y
									target = client
									x = cmdCheck[1]
									y = cmdCheck[2]

									message = `Teleported to ${x} ${y}`
									break
								case 2:
									//tp id
									destination = world.clients.find(function(item) {
										return item.id == cmdCheck[1]
									})

									if (destination) {
										target = client
										x = Math.floor(destination.x_pos / 16)
										y = Math.floor(destination.y_pos / 16)
										message = `Teleported to player ${cmdCheck[1]} (${x},${y})`
									} else {
										message = `Error! Player '${cmdCheck[1]}' not found!`
									}
									break
								default:
									send("To change the position of another player: /tp id x y");
									send("To teleport to another player: /tp id");
									send("To change your location: /tp x y");
									break
							}

							if (target) {
								let tp = new Uint8Array(9)
								let tp_dv = new DataView(tp.buffer);

								tp_dv.setUint8(0, TELEPORT);
								tp_dv.setUint32(1, x, true);
								tp_dv.setUint32(5, y, true);

								target.send(tp);
								target.send(message)
							}

						} else if (cmdCheck[0] == "sayraw" && (client.serverRank > permissions.user)) {
							var msg = command.split(" ");
							msg.shift();
							msg = msg.join(" ");

							currentWorldSend(msg)
						} else if (cmdCheck[0] == "stealth" && (client.serverRank > permissions.user)) {
							if (!client.stealth) {
								client.stealth = true;
								send("Stealth mode enabled");
							} else {
								client.stealth = false;
								send("Stealth mode disabled");
							}
						} else if (cmdCheck[0] == "broadcast") {
							var pw_arg = cmdCheck[1];
							if (config.global_chat_pw != pw_arg) {
								send("Wrong password or you don't know how to use it.");
								send("Correct example: /broadcast pass message");
								send("Wrong example: '/broadcast wrongpass message' or '/broadcast message'");
								return;
							}
							var msg = command.split(" ");
							msg.shift();
							msg.shift();
							msg = msg.join(" ");
							sendToWorlds("<span style='color: #ffff00'>[GLOBAL]</span> " + before + ": " + msg)
						} else {
							send("Command not recognized")
						}
					}
				}
			}
		}
		//console.log(message)
	});
	ws.on("close", function() {
		//console.log("closed")
		if (!world) return;
		if (!client) return;
		var clIdx = world.clients.indexOf(client);
		if (clIdx > -1) {
			doUpdatePlayerLeave(worldName, client.id)
			world.clients.splice(clIdx, 1);
		}
	})
	ws.on("error", function(a, b, c) {
		console.log("err", a, b, c)
	})
	send(new Uint8Array([5, 3]))
}

async function saveDatabase() {
	var new_worlds = db_updates.new_worlds;
	var tile_upd = db_updates.tile_upd;
	var tile_protect = db_updates.tile_protect;

	db_updates.new_worlds = {};
	db_updates.tile_upd = {};
	db_updates.tile_protect = {};

	var hasUpdated = false;

	await db.run("BEGIN TRANSACTION")

	for (var name in new_worlds) {
		var worldId = (await db.run("INSERT INTO worlds VALUES(null, ?)", name));
		world_id_table[name] = worldId.lastID
		hasUpdated = true;
	}

	for (var world in tile_upd) {
		var dat = tile_upd[world];
		var worldID = world_id_table[world];
		var world_protect = tile_protect[world] || [];
		for (var tkey in dat) {
			var tile = dat[tkey];
			var pos = tkey.split(",").map(Number);
			var tileX = pos[0];
			var tileY = pos[1];
			var dataStr = "";
			var tileProtect = world_protect[tkey];

			for (var t = 0; t < tile.length; t++) {
				dataStr += String.fromCharCode(tile[t]);
			}

			await db.run("INSERT OR REPLACE INTO tiles (world, x, y, data, protect) VALUES (?, ?, ?, ?, ?)", [worldID, tileX, tileY, dataStr, tileProtect]);
		}
		hasUpdated = true;
	}

	await db.run("COMMIT")

	if (hasUpdated) console.log("Saved world in database");
}

var lastDBSave = false;
var lastDBCallback;

var sdbt;
async function saveDbInterval() {
	await saveDatabase();
	if (lastDBSave) {
		if (lastDBCallback) lastDBCallback();
	}
	sdbt = setTimeout(saveDbInterval, 1000 * 5)
};

var terminatedSocketServer = false;

var wss;

function createWSServer() {
	wss = new ws.Server({
		port: config.port
	});

	wss.on("connection", wssOnConnection);
}

console.log("Type 'k' or 'kill' (and press enter) to close this server (safe but slower)");
console.log("Type 'n' to close this server (but it doesn't save world if you have many players dont use it).");
console.log("Type 'cmdmode' or 'commandmode' to set mode of typying to command mode.");
console.log("Type 'msgmode' or 'messagemode' to set mode of typying to message mode.");
console.log("Type anything (with message mode) to send this in chat.");
console.log("Type command (like console.log('lol')) (with command mode) to eval it.");

async function beginServer() {
	console.log("beginServer...");

	if (!fs.existsSync("./bans.txt")) {

		fs.writeFile("./bans.txt", ``, function(err) {
			if (err) {
				return console.log(err);
			}
		});
	}

	await db.run("CREATE TABLE IF NOT EXISTS worlds (id INTEGER PRIMARY KEY, name TEXT NOT NULL)")
	await db.run("CREATE TABLE IF NOT EXISTS tiles (world INTEGER, x INTEGER, y INTEGER, data BLOB, protect BOOLEAN DEFAULT FALSE, PRIMARY KEY(world, x, y))")

	var wld_id = {};

	var worldsDB = await db.all("SELECT * FROM worlds")
	var tilesDB = await db.all("SELECT * FROM tiles")

	for (var i = 0; i < worldsDB.length; i++) {
		var world = worldsDB[i];
		wld_id[world.id] = world.name;
		world_id_table[world.name] = world.id;
		worlds[world.name] = worldTemplate();
	}

	for (var i = 0; i < tilesDB.length; i++) {
		if (i % 2000 == 0) console.log(i, tilesDB.length);
		var tile = tilesDB[i];
		var worldName = wld_id[tile.world];
		var tileX = tile.x;
		var tileY = tile.y;
		var tileDataRaw = tile.data;
		var tileData = new Uint8Array(16 * 16 * 3);
		for (var c = 0; c < tileDataRaw.length; c++) {
			var code = tileDataRaw.charCodeAt(c);
			tileData[c] = code;
		}
		var tile_str = tileX + "," + tileY;
		worlds[worldName].tiles[tile_str] = tileData;
		worlds[worldName].tiles_protect[tile_str] = tile.protect;
	}

	console.log("Starting server...");
	console.log(" ");

	saveDbInterval();
	createWSServer();
	console.log("Server running on port " + config.port)
	setTimeout(function() {
		console.log(" ");
		console.log(" ");
		console.log("Adminlogin: " + config.adminlogin);
		console.log("Modlogin: " + config.modlogin);
		console.log("Broadcast pass: " + config.global_chat_pw);
		console.log(" ");
	}, 1000);
}
beginServer();

var stdin = process.openStdin();
var sendToPlayersMessage = true;
stdin.on("data", function(d) {
	var msg = d.toString().trim();
	if (terminatedSocketServer) return;
	if (msg.toLowerCase() == "n") { // cancels server (unsafe)
		process.exit();
		return;
	} else if (msg.toLowerCase() == "k" || msg.toLowerCase() == "kill" || msg.toLowerCase() == "stop") { // close server (safe, but slower)
		console.log("Exiting...")
		terminatedSocketServer = true;
		lastDBSave = true;
		for (var w in worlds) {
			var world = worlds[w];
			for (var c = 0; c < world.clients.length; c++) {
				var client = world.clients[c]
				client.send(closeMsg)
			}
		}
		lastDBCallback = function() {
			process.exit();
		}
		return;
	} else if (msg.toLowerCase() == "commandmode" || msg.toLowerCase() == "cmdmode") {
		sendToPlayersMessage = false;
		console.log("Using cmdMode");
		return;
	} else if (msg.toLowerCase() == "msgmode" || msg.toLowerCase() == "messagemode") {
		sendToPlayersMessage = true;
		console.log("Using msgMode")
		return;
	}
	if (sendToPlayersMessage) {
		function sendToWorlds(msg) {
			for (var gw in worlds) {
				var worldCurrent = worlds[gw];
				var clientsOfWorld = worldCurrent.clients;
				for (var s = 0; s < clientsOfWorld.length; s++) {
					var sendToClient = clientsOfWorld[s].send;
					sendToClient(msg)
				}
			}
		}
		sendToWorlds("<span style='color: red'>[SERVER]</span> " + msg)
	} else {
		try {
			return console.log(String(eval(msg)))
		} catch (e) {
			console.log('[ERROR]:' + e.name + ":" + e.message + "\n" + e.stack)
		}
	}
});