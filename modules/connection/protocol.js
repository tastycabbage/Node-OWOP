var protocol = {
	server: {
		setId: 0,
		worldUpdate: 1,
		chunkLoad: 2,
		teleport: 3,
		setRank: 4,
		captcha: 5,
		setPQuota: 6,
		chunkProtected: 7,
		maxCount: 8
	},
	client: {
		antiCheat: 1,
		//captcha: 6,
		requestChunk: 8,
		clearChunk: 9,
		protectChunk: 10,
		setPixel: 11,
		playerUpdate: 12,
		paste: 776
	}
}

module.exports = protocol