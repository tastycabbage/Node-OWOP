const permissions = require("../player/permissions.js")
class WorldTemplate {
	constructor(name) {
		this.name = name;
		this.latestId = 1;
		this.clients = []
	}
	sendToAdmins(msg) {
		this.clients.forEach(function(client) {
			if(client.rank == permissions.admins) client.send(msg);
		})
	}
	sendToMods(msg) {
		this.clients.forEach(function(client) {
			if(client.rank == permissions.mod) client.send(msg);
		})
	}
	sendToStaff(msg) {
		this.sendToMods(msg);
		this.sendToAdmins(msg)
	}
	sendToAll(msg) {
		this.clients.forEach(function(client) {
			client.send(msg)
		})
	}
}

module.exports = WorldTemplate
