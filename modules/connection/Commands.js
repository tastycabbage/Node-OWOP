var config = require("../../config");
const permissions = require("./permissions.js")
class Commands {
	constructor(chat, client, world, worlds, manager) {
		chat = chat.substr(1);
		this.world = world
		this.worlds = worlds
		this.manager = manager
		this.command = chat.split(" ")[0];
		this.args = chat.split(" ");
		this.args.shift();
		this.client = client;
		if (typeof this[this.command] == "function") {
			this[this.command]()
		}
		/* else {
		      this.client.send("Command not recognized!")
		    }*/

	}
	adminlogin() {
		var password = this.args.join(" ").trim()
		if (password == config.adminlogin) {
			this.client.setRank(permissions.admin)
			this.client.send("Server: You are now an admin. Do /help for a list of commands.")
		} else {
			this.client.send("Wrong password.")
		}
		return true;
	}
	modlogin() {
		var password = this.args.join(" ").trim()
		if (password == config.modlogin || password == this.manager.get_prop(this.world.name, "pass")) {
			this.client.setRank(permissions.mod)
			this.client.send("Server: You are now an mod. Do /help for a list of commands.")
		} else {
			this.client.send("Wrong password.")
		}
	}
	nick() {
		var newNick = this.args.join(" ").trim()
		if (newNick.length == 0) {
			this.client.nick = "";
			this.client.send("Nickname reset.");
			return;
		}
		if (newNick.length <= config.maxNickLength || this.client.rank > permissions.user) {
			this.client.nick = newNick;
			this.client.send("Nickname set to: '" + newNick + "'");
		} else {
      this.client.send("Nickname too long! (Max: " + config.maxNickLength + ")");
		}
	}
}
module.exports = Commands
