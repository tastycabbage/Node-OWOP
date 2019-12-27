const compress_data_to = require("./compressData.js")
function getTile(worldName, tileX, tileY, manager) {
	var tile = manager.get_chunk(worldName, tileX, tileY);
	if (!tile) {
		tile = new Uint8Array(16 * 16 * 3);
		for (var i = 0; i < 16 * 16 * 3; i++) {
			tile[i] = 255;
		}
	}
	var tileProtect = manager.chunk_is_protected(worldName, tileX, tileY)
	return compress_data_to(tile, tileX, tileY, tileProtect)
}
module.exports = getTile
