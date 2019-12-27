function worldTemplate() {
	return {
		latestId: 1,
		name: "",
		PlayersUpdates: {
			player: [],
			tile: [],
			protect: []
		},
		clients: []
	}
}

module.exports = worldTemplate
