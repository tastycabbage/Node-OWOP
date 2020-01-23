class WorldTemplate { //lazy to change
	constructor(name) {
		this.name = name;
		this.latestId = 1;
		this.clients = []
	}
}

module.exports = WorldTemplate
