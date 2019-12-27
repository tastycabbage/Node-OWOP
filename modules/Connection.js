const request = require("request")
const Client = require('./connection/Client.js');
var config = require("../config");
const protocol = require("./connection/protocol.js");
const captchaStates = require("./captchaStates.js");
const worldTemplate = require("./worldTemplate.js");
const permissions = require("./connection/permissions.js")
const Case = require('./connection/cases.js');
const Bucket = require("./connection/Bucket.js")

class Connection {
	constructor(ws, req, worlds, bans, manager) {
		this.ws = ws;
		this.req = req;
		this.bans = bans
		this.manager = manager
		this.worlds = worlds
		this.world = null;
		this.client = new Client(ws, req);
		this.player = false

		//ws.on("message", function (msg) this.onMessage(msg, this.client, this.world, this.worlds, this.req, this.ws, this.player));
		ws.on("message", this.onMessage.bind(this));
		ws.on("close", this.onClose.bind(this));
		ws.on("error", this.onError.bind(this));
	}
	sendToAll() {

	}
	onMessage(message) {
		var data = new Uint8Array(message)
		var dv = new DataView(data.buffer)
		var len = message.length;
		var isBinary = (typeof message == "object");
		if (this.player && isBinary) {
			//cases
			new Case(message, this.client, this.world, this.worlds, this.manager).case()
		} else if (this.player && !isBinary) {
			//messages and commands

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
				this.world = this.worlds.find(function(world) {return world.name == this.client.world}.bind(this));
					if (!this.world) {
						this.manager.world_init(this.client.world)
						this.world = worldTemplate();
						this.world.name = this.client.world
						this.worlds.push(this.world)
					}

				var pass = this.manager.get_prop(this.client.world, "pass", undefined);


				if(pass) {
					this.client.send(" [Server] This world has a password set. Use '/pass PASSWORD' to unlock drawing.")
					this.client.serverRank = permissions.none
					this.client.send(new Uint8Array([protocol.server.setRank, this.client.serverRank]))
					var paintrate = 0;
					var per = 1;
					var quota = new Uint8Array(5)
					var quota_dv = new DataView(quota.buffer);
					quota_dv.setUint8(0, protocol.server.setPQuota);
					quota_dv.setUint16(1, paintrate, true);
					quota_dv.setUint16(3, per, true);
					this.client.send(quota)
					this.client.pbucket = new Bucket(paintrate, per)
				} else {
					this.client.serverRank = permissions.admin
					this.client.send(new Uint8Array([protocol.server.setRank, this.client.serverRank]))
					var paintrate = 50;
					var per = 4;
					var quota = new Uint8Array(5)
					var quota_dv = new DataView(quota.buffer);
					quota_dv.setUint8(0, protocol.server.setPQuota);
					quota_dv.setUint16(1, paintrate, true);
					quota_dv.setUint16(3, per, true);
					this.client.send(quota)
					this.client.pbucket = new Bucket(paintrate, per)
				}
				this.client.send("Hello This is test version of Node OWOP...")
				this.client.send("As you see it's not ended.")
				this.client.id = this.world.latestId
				this.world.latestId++


				this.player = true;
				var id = new Uint8Array(5);
				var id_dv = new DataView(id.buffer);
				id_dv.setUint8(0, protocol.server.setId);
				id_dv.setUint32(1, this.client.id, true);
				this.client.send(new Uint8Array(id))
				this.world.clients.push(this.client);
			}


		} else if (!this.player && !isBinary) {
			if (message.startsWith(config.captcha.clientSideVerificationKey) && config.captcha.enabled == true) {
				var key = message.slice(config.captcha.clientSideVerificationKey.length);
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
			//doUpdatePlayerLeave(worldName, client.id)
			delete this.world.clients[clIdx]
			this.world.clients.sort().pop()
		}
		if(!this.world.clients.length) {
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
