var config = require("../../../config");
const permissions = require("../player/permissions.js")
const commandPermissions = require("./commandPermissions.json")
class Commands {
	constructor(chat, client, world, worlds, manager) {
		chat = chat.substr(1);
		this.world = world
		this.worlds = worlds
		this.manager = manager
		this.command = chat.split(" ")[0].toLowerCase();
		this.args = chat.split(" ");
		this.args.shift();
		this.client = client;
		server.events.emit("command", this.client, this.command, this.args)
		if (typeof this[this.command] == "function" && this.command != "sendTo") {
			if(commandPermissions[this.command] <= this.client.rank) {
				this[this.command]();
			}/* else {
				this.client.send("You can't use this command!")
			}*/
		}/* else if (typeof this[this.command] == "undefined") {
			this.client.send("Command not recognized")
		}*/
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
	adminlogin() {
		var password = this.args.join(" ");
		if (password == config.adminlogin) {
			this.client.setRank(permissions.admin)
			this.client.send("Server: You are now an admin. Do /help for a list of commands.")
		} else {
			this.client.send("Wrong password.")
		}
	}
	modlogin() {
		var password = this.args.join(" ");
		if (password == config.modlogin) {
			this.client.setRank(permissions.mod)
			this.client.send("Server: You are now an moderator. Do /help for a list of commands.")
		} else {
			this.client.send("Wrong password.")
		}
	}
	nick() {
		var newNick = this.args.join(" ");
		if (newNick.length == 0) {
			this.client.nick = "";
			this.client.send("Nickname reset.");
			return;
		}
		if (newNick.length <= config.maxNickLength || this.client.rank > permissions.user) {
			this.client.nick = newNick;
			this.client.send(`Nickname set to: "${newNick}"`);
		} else {
			this.client.send(`Nickname too long! (Max: "${config.maxNickLength}")`);//wat are you doing
		}
	}
	setprop() {
		var property = this.args[0];
		var value = this.args;
		value.shift()
		value = value.join(" ").trim()
		if (property && value) {
			this.manager.set_prop(this.world.name, property, value)
			this.sendTo("worldstaff", `DEVSet world property ${property} to ${value}`)
		} else if (property && !value) {
			this.client.send(`Value of ${property} is ${this.manager.get_prop(this.world.name, property, "undefined")}`)
		} else if (!property) {
			this.client.send("Usage:\n /setprop [property] [value]\n or /setprop [property] to get value")
		}
	}
	sayraw() {
		var message = this.args.join(" ");
		if (message) {
			this.sendTo("world", message);
		} else {
			this.client.send("Usage:\n /sayraw [message]")
		}
	}
	broadcast() {
		var message = this.args.join(" ");
		if (message) {
			this.sendTo("all", `<span style='color: #ffff00'>[GLOBAL]</span> ${message}`);
		} else {
			this.client.send("Usage:\n /broadcast [message]")
		}
	}
	stealth() {
		if (!this.client.stealth) {
			this.client.stealth = true;
			this.client.send("Stealth mode enabled");
		} else {
			this.client.stealth = false;
			this.client.send("Stealth mode disabled");
		}
	}
	setrank() {
		var id = parseInt(this.args[0]);
		var target = this.world.clients.find(function(client) {
			return client.id == id
		});
		var rank = parseInt(this.args[1]);

		if (isNaN(rank)) {
			this.client.send("Usage:\n /setrank [target id] [new rank from 0 to 3]")
		} else if (!target) {
			this.client.send(`Cannot find client with id ${id}`)
		} else if (target.rank >= this.client.rank) {
			this.client.send("You cannot change the rank of players who have a higher rank than you or equal.")
		} else if (target && rank >= 0 && this.client.rank < rank) {
			target.setRank(rank)
		}
	}
	pass() {
		var password = this.args.join(" ");
		if (password == this.manager.get_prop(this.world.name, "pass")) {
			this.client.setRank(1);
		} else if (password == this.manager.get_prop(this.world.name, "modlogin")) {
			this.client.setRank(2);
			this.client.send("Server: You are now an moderator. Do /help for a list of commands.")
		} else {
			this.client.send("Wrong password.");
		}
	}
	tp() {
		let target

		let x, y

		let message
		switch (this.args.length) {
			case 3:
				//tp id x y
				target = this.world.clients.find(function(item) {
					return item.id == this.args[0]
				}.bind(this))

				if (target) {
					x = this.args[1]
					y = this.args[2]
					message = `Teleported player ${this.args[0]} to ${x},${y}`
				} else {
					message = `Error! Player '${this.args[0]}' not found!`
				}
				break
			case 2:
				//tp x y
				target = this.client
				x = this.args[0]
				y = this.args[1]

				message = `Teleported to ${x} ${y}`
				break
			case 1:
				//tp id
				var destination = this.world.clients.find(function(item) {
					return item.id == this.args[0]
				}.bind(this))

				if (destination) {
					target = this.client
					x = Math.floor(destination.x_pos / 16)
					y = Math.floor(destination.y_pos / 16)
					message = `Teleported to player ${this.args[0]} (${x},${y})`
				} else {
					message = `Error! Player '${this.args[0]}' not found!`
				}
				break
			default:
				this.client.send("To change the position of another player: /tp id x y");
				this.client.send("To teleport to another player: /tp id");
				this.client.send("To change your location: /tp x y");
				break
		}

		if (target) {
			target.teleport(x, y)
			this.client.send(message)
		}
	}
  	tpall() {

    }
		kick() {
			var id = parseInt(args[0]);
			var target = this.world.clients.find(function(item) {
				return item.id == id
			}.bind(this))
			if (id && target) {
								sendStaff(`DEVKicked: ${id}`)
								client.send(`Kicked: ${id}`)
								target.ws.close();
							} else if (!target && id) {
								client.send(`User ${id} not found.`)
							} else if (!id) {
								client.send("Usage: /kick id")
							}
		}
		ao() {

		}
		whois() {

		}
		banip() {

		}
		ban() {

		}
		unban() {

		}
		unbanip() {

		}
		kick() {

		}
		kickip() {

		}
		disconnect() {
			this.client.send("Disconnected");
			this.client.ws.close();
		}
		help() {

		}
		tellraw() {
			var id =  this.args[0];
			var message = this.args;
			message.shift()
			message = message.join(" ")
			var target = this.world.clients.find(function(item) {
				return item.id == id
			}.bind(this))
			if (message && target) {
				target.send(message);
			} else {
				this.client.send("Usage:\n /tellraw [id] [message]")
			}
		}
		tell() {

		}
		getid() {
			return // cuz it does't works
			var nick = this.args.join(" ");
			var listOfIds = [];

			if(nick) {
				console.log(this.world.clients)
				for(var i = 0; i < this.world.clients; i++) {
					var client = this.world.clients[i]

					if(client.nick == nick) {
						listOfIds.push(client.id);
					}
				}
				if(listOfIds.length) {
					var ids = listOfIds.join(" ")
					this.client.send("There is " + listOfIds.length + "ids. \n" + ids)
				} else {
					this.client.send("There is no ids")
				}
			} else {
				this.client.send("Usage:\n /getId [nick]")
			}
		}
}
	/*save() {
		//this.manager
	}*/
	module.exports = Commands;
