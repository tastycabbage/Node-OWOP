const Client = require('./connection/Client');

class Connection {
	constructor(ws, req) {
		this.ws = ws;
		this.req = req;
		this.client = new Client(ws, req);
		
		ws.on("message", this.onMessage);
	}
	currentWorldSend(msg) {
		world.clients.forEach(function(client) {
			client.send(msg)
		})
	}
	sendStaff(msg) {
		world.clients.forEach(function(client) {
			//console.log(client)
			if (client.serverRank > permissions.user) {
				client.send(msg)
			}
		})
	}
	sendToWorlds(msg) {
		for (var gw in worlds) {
			var worldCurrent = worlds[gw];
			var clientsOfWorld = worldCurrent.clients;
			for (var s = 0; s < clientsOfWorld.length; s++) {
				var sendToClient = clientsOfWorld[s].send;
				sendToClient(msg)
			}
		}
	}
	currentWorldSend(msg) {
		world.clients.forEach(function(client) {
			client.send(msg)
		})
	}
	sendStaff(message) {
		world.clients.forEach(function(client) {
			//console.log(client)
			if (client.serverRank > permissions.user) {
				client.send(message)
			}
		})
	}
	sendToWorlds(msg) {
		for (var gw in worlds) {
			var worldCurrent = worlds[gw];
			var clientsOfWorld = worldCurrent.clients;
			for (var s = 0; s < clientsOfWorld.length; s++) {
				var sendToClient = clientsOfWorld[s].send;
				sendToClient(msg)
			}
		}
	}
	send(data) {
		try {
			ws.send(data)
		} catch (e) {};
	}
	
	onMessage(message) {
		var data = new Uint8Array(message)
		var dv = new DataView(data.buffer)
		var len = message.length;
		var isBinary = (typeof message == "object");
		var player = false;
		var world = null;
		console.log(len)
		if(!isBinary && !player) {
			if(message.startsWith(config.captcha.clientSideVerificationKey)) {
				var key = message.replace(config.captcha.clientSideVerificationKey, "");
				client.send(new Uint8Array([protocol.server.captcha, captchaStates.veryfying]))
				request(`https://www.google.com/recaptcha/api/siteverify?secret=${config.captcha.serverKey}&response=${key}`, function(error, response, body) {
						if(error) {
							client.send("Captcha error. Contact with administrator");
							client.ws.close();
						}
						body = body.replace(/\r/g, '');
						var jsonresponse = JSON.parse(body);
						if (jsonresponse.success == true) {
							client.send(new Uint8Array([protocol.server.captcha, captchaStates.verifed]));
							client.send(new Uint8Array([protocol.server.captcha, captchaStates.ok]));
						} else {
							client.send("Wrong captcha!");
							client.send(new Uint8Array([protocol.server.captcha, captchaStates.verifed]));
							client.send(new Uint8Array([protocol.server.captcha, captchaStates.invaild]));
							client.ws.close()
						}
					})
			}
		} else if (player && isBinary) {
			//cases
			
		} else if (!player && isBinary) {
			if (len > 2 && len - 2 <= 24 /*&& dv.getUint16(len - 2, true) == 1234*/) {
				if (config.antiproxy) {
					request("http://proxycheck.io/v2/" + client.ip, function(error, response, body) {
						body = body.replace(/\r/g, '');
						var isproxy = JSON.parse(body).proxy;
						if (isproxy == "yes") {
							client.send("Proxy detected!");
							client.ws.close()
							return;
						}
					})
				}
				/*var bans = JSON.parse(fs.readFileSync("./bans.json").toString());
				bans.hasOwnProperty(client.ip);
				if(var ban = bans[client.ip]) {
					let timestamp = ban.date + ban.expires - Date.now();
					let date = new Date(timestamp);
					Date.getMinutes();
					Date.getSeconds();
				}
				
				if (fs.existsSync("./bans.json")) {
					var bans = JSON.parse(fs.readFileSync("./bans.json").toString());
					for(var i in bans) {
						var ban = bans[i];
						if (i == client.ip) {
							if(ban.type == "time") {
								if(Date.now() - ban.date <= ban.expires) {
									sendBannedMessage();
								}
							} else {
								sendBannedPermMessage(reson);
							}
						}
					}
				} else {
					console.error("Can't find bans.json file!");
					console.warn("Kicking all persons which will join!");
					client.send("Server error: Can't find file with banned persons. Contact with owner of server")
					client.ws.close();
				}*/
				var str = ""
				for (var i = 0; i < data.length - 2; i++) {
					str += String.fromCharCode(data[i])
				}
				str = str.replace(/[^a-zA-Z0-9\._]/gm, "").toLowerCase();
				if (!str) str = "main";
				if (!worlds[str]) {
					worlds[str] = worldTemplate();
				}
				world = worlds[str];
				client.id = world.latestId
				client.world = str
			}
		}
	}
}
module.exports = Connection