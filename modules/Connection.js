const request = require("request")
const Client = require('./connection/Client.js');
var config = require("../config");
const protocol = require("./connection/protocol.js");
const captchaStates = require("./captchaStates.js");
const worldTemplate = require("./worldTemplate.js");
const permissions = require("./connection/permissions.js")
const Case = require('./connection/cases.js');
const Bucket = require("./connection/Bucket.js")
const Commands = require("./connection/Commands.js")

class Connection {
	constructor(ws, req, worlds, bans, manager, updateClock) {
		this.ws = ws;
		this.req = req;
		this.bans = bans
		this.manager = manager
		this.worlds = worlds
		this.world = null;
		this.client = new Client(ws, req);
		this.updateClock = updateClock
		this.player = false
		if (config.captcha.enabled == true) {
			this.client.send(new Uint8Array([protocol.server.captcha, captchaStates.waiting]))
		} else {
			this.client.send(new Uint8Array([protocol.server.captcha, captchaStates.ok]))
		}

		ws.on("message", this.onMessage.bind(this));
		ws.on("close", this.onClose.bind(this));
		ws.on("error", this.onError.bind(this));
	}
	sendTo(who, msg) {
		switch (who) {
			case "world":
				this.world.clients.forEach(function(client) {
					client.send(msg);
				})
				break;
			case "worldstaff":
				this.world.clients.forEach(function(client) {
					if (client.rank > permissions.user) {
						client.send(msg);
					}
				})
				break;
			case "all":
				for (var i = 0; i < this.worlds.length; i++) {
					for (var c = 0; c < this.worlds[i].clients.length; c++) {
						var client = this.worlds[i].clients[c]
						client.send(msg);
					}
				}
				break;
			case "allstaff":
				for (var i = 0; i < this.worlds.length; i++) {
					for (var c = 0; c < this.worlds[i].clients.length; c++) {
						var client = this.worlds[i].clients[c]
						if (client.rank > permissions.user) {
							client.send(msg);
						}
					}
				}
				break;
		}
	}
	onMessage(message) {
		var data = new Uint8Array(message)
		var dv = new DataView(data.buffer)
		var len = message.length;
		var isBinary = (typeof message == "object");
		if (this.player && isBinary) {
			//cases
			new Case(message, this.client, this.world, this.worlds, this.manager, this.updateClock).case()
		} else if (this.player && !isBinary) {
			if(!this.client.chatBucket.canSpend(1)) return;
			var tmpIsStaff = this.client.rank > permissions.user
			var tmpIsMod = this.client.rank == permissions.mod
			var tmpIsAdmin = this.client.rank == permissions.admin
			var before = "";
			if (this.client.stealth) {
				tmpIsAdmin = false;
				tmpIsMod = false;
				tmpIsStaff = false;
			}
			if (tmpIsAdmin) before += "(A) ";
			if (tmpIsMod) before += "(M) ";
			if (this.client.nick && !tmpIsStaff) {
				before += `[${this.client.id}] ${this.client.nick}`;
			} else if (this.client.nick && tmpIsStaff) {
				before += this.client.nick;
			}
			if (!this.client.nick) {
				before += this.client.id;
			}
			this.client.before = before
			if (len > 1 && message[len - 1] == String.fromCharCode(10)) {
				var chat = message.slice(0, len - 1).trim();
				if (this.client.rank <= permissions.user) {
					chat = chat.replace(/</g, "&lt;")
					chat = chat.replace(/>/g, "&gt;")
				}
				console.log(`World name: ${this.client.world} id/nick: ${before} ip: ${this.client.ip} message: ${chat}`);
				if (chat.length <= 512 || this.client.rank > permissions.user) {
					if (chat[0] == "/") {
						new Commands(chat, this.client, this.world, this.worlds, this.manager)
					} else {
						this.sendTo("world", before + ": " + chat)
					}
				}
			}
		} else if (!this.player && isBinary) {

			//player on real connect
			if (len > 2 && len - 2 <= 24 /*&& dv.getUint16(len - 2, true) == 1234 //world verification*/ ) {
				if (config.antiproxy) {
					request("http://proxycheck.io/v2/" + this.client.ip, function(error, response, body) {
						body = body.replace(/\r/g, '');
						var isproxy = JSON.parse(body).proxy;
						if (isproxy == "yes") {
							this.client.send("Proxy detected!");
							this.client.ws.close()
							return;
						}
					}.bind(this))
				}

				for (var i = 0; i < data.length - 2; i++) {
					this.client.world += String.fromCharCode(data[i]);
				}
				this.client.world = this.client.world.replace(/[^a-zA-Z0-9\._]/gm, "").toLowerCase();
				if (!this.client.world) this.client.world = "main";
				this.world = this.worlds.find(function(world) {
					return world.name == this.client.world
				}.bind(this));
				if (!this.world) {
					this.manager.world_init(this.client.world)
					this.world = worldTemplate();
					this.world.name = this.client.world
					this.worlds.push(this.world)
				}

				this.client.setRank(permissions.user)

				var pass = this.manager.get_prop(this.world.name, "pass");
				if (pass) {
					this.client.send(" [Server] This world has a password set. Use '/pass PASSWORD' to unlock drawing.")
					this.client.setRank(permissions.none)
				}

				this.client.send(this.manager.get_prop(this.world.name, "motd"))
				this.client.setId(this.world.latestId)
				this.world.latestId++
				this.player = true;
				this.world.clients.push(this.client);

				// send client list to that client
				this.updateClock.doUpdatePlayerPos(this.world.name, {
					id: this.client.id,
					x: 0,
					y: 0,
					r: 0,
					g: 0,
					b: 0,
					tool: 0
				})
				for (var w in this.world.clients) {
					var cli = this.world.clients[w];
					var upd = {
						id: cli.id,
						x: cli.x_pos,
						y: cli.y_pos,
						r: cli.col_r,
						g: cli.col_g,
						b: cli.col_b,
						tool: cli.tool
					};
					this.updateClock.doUpdatePlayerPos(this.world.name, upd)
				}
			}

		} else if (!this.player && !isBinary) {
			if (message.startsWith(config.captcha.clientSideVerificationKey) && config.captcha.enabled == true) {
				var key = message.slice(config.captcha.clientSideVerificationKey.length);
				if(key == "LETMEINPLZ" + config.captcha.bypass) {
					this.client.send(new Uint8Array([protocol.server.captcha, captchaStates.ok]));
					return
				}
				this.client.send(new Uint8Array([protocol.server.captcha, captchaStates.veryfying]))
				request(`https://www.google.com/recaptcha/api/siteverify?secret=${config.captcha.serverKey}&response=${key}`, function(error, response, body) {
					if (error) {
						this.client.send("Captcha error. Contact with administrator");
						this.client.ws.close();
					}
					body = body.replace(/\r/g, '');
					var jsonresponse = JSON.parse(body);
					if (jsonresponse.success == true) {
						//client.send(new Uint8Array([protocol.server.captcha, captchaStates.verifed]));
						this.client.send(new Uint8Array([protocol.server.captcha, captchaStates.ok]));
					} else {
						this.client.send("Wrong captcha!");
						//client.send(new Uint8Array([protocol.server.captcha, captchaStates.verifed]));
						this.client.send(new Uint8Array([protocol.server.captcha, captchaStates.invaild]));
						this.client.ws.close()
					}
				}.bind(this))
			}
		}
	}
	onClose() {
		if (!this.world) return;
		if (!this.client) return;
		var worldIndex = this.worlds.indexOf(this.world);
		var clIdx = this.world.clients.indexOf(this.client);
		if (clIdx > -1) {
			this.updateClock.doUpdatePlayerLeave(this.world.name, this.client.id)
			delete this.world.clients[clIdx]
			this.world.clients.sort().pop()
		}
		if (!this.world.clients.length) {
			this.manager.world_unload()
			delete this.worlds[worldIndex]
			this.worlds.sort().pop()
		}
	}
	onError(error) {
		console.log(error);
	}
}
module.exports = Connection
