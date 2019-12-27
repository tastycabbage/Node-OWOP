const protocol = require('./protocol.js');
const getTile = require('./getTile.js');
const compress_data_to = require("./compressData.js")
const permissions = require("./permissions.js")
class Case {
  constructor(message, client, world, worlds, manager) {
    this.manager = manager
    this.message = message
    this.client = client
    this.world = world
    this.worlds = world
    this.data = new Uint8Array(this.message)
    this.dv = new DataView(this.data.buffer)
    this.len = this.message.length;
  }
  case() {
    //console.log("ded")
    switch(this.len) {
      case protocol.client.anticheat:
      var clientRank = this.dv.getUint8(0);
      if (clientRank > this.client.serverRank) {
        this.client.send("Do not cheat!")
        this.client.ws.close()
      }
      break;
      case protocol.client.requestChunk: //loading chunks
      var x = this.dv.getInt32(0, true);
      var y = this.dv.getInt32(4, true);
      var tile = getTile(this.world.name, x, y, this.manager);
      this.client.send(tile);
      break;
      case protocol.client.clearChunk:
      if (this.client.serverRank > permissions.user) {
          var x = this.dv.getInt32(0, true);
          var y = this.dv.getInt32(4, true);
          var newData = new Uint8Array(16 * 16 * 3);
          for (var i = 0; i < 16 * 16 * 3; i++) {
            newData[i] = 255
          }
          this.manager.set_chunk(x, y, newData);
          var newTileUpdated = getTile(this.world.name, x, y, this.manager);
          var clients = this.world.clients;

          for (var s = 0; s < clients.length; s++) {
            var current_send = clients[s].send;
            current_send(newTileUpdated)
          }

        } else {
          this.client.ws.close();
        }
      break;
      case protocol.client.protectChunk:
      if (this.client.serverRank > permissions.user) {
						var tileX = this.dv.getInt32(0, true);
						var tileY = this.dv.getInt32(4, true);
						var tile_protect = !!this.dv.getUint8(8);

            this.manager.set_chunk_protection(this.world.name, tileX, tileY, tile_protect);

            var newTileUpdated = getTile(this.world.name, tileX, tileY, this.manager);
            console.log(newTileUpdated)
						var clients = this.world.clients;

						for (var s = 0; s < clients.length; s++) {
							var current_send = clients[s].send;
							current_send(newTileUpdated)
						}
					} else {
						this.client.ws.close()
					}
					break;
      break;
      case protocol.client.setPixel:
      if (!this.client.pbucket.canSpend(1)) return;
      var x = this.dv.getInt32(0, true);
					var y = this.dv.getInt32(4, true);
					var r = this.dv.getUint8(8);
					var g = this.dv.getUint8(9);
					var b = this.dv.getUint8(10);

					var tileX = Math.floor(x / 16);
					var tileY = Math.floor(y / 16);
					var pixX = x - Math.floor(x / 16) * 16;
					var pixY = y - Math.floor(y / 16) * 16;

          if(this.manager.chunk_is_protected(this.client.world, tileX, tileY) && this.client.rank < permissions.mod) return;
          this.manager.set_pixel(this.world.name, tileX, tileY, pixX, pixY, r, g, b)

      break;
      case protocol.client.paste:
      if (this.client.serverRank > permissions.user) {
						var x = this.dv.getInt32(0, true);
						var y = this.dv.getInt32(4, true);
						var offset = 8;
						var newData = new Uint8Array(16 * 16 * 3);
						for (var i = 0; i < 16 * 16 * 3; i++) {
							newData[i] = this.dv.getUint8(i + offset);
						}
						this.manager.set_chunk_rgb(this.world.name, x, y, newData)

						var newTileUpdated = getTile(this.world.name, x, y, this.manager);
						var clients = this.world.clients;

						for (var s = 0; s < clients.length; s++) {
							var current_send = clients[s].send;
							current_send(newTileUpdated)
						}
					} else {
						this.client.ws.close();
					}
          break;
    }
  }
}

module.exports = Case
