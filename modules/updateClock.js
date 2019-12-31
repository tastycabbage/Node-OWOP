const protocol = require("./connection/protocol.js");
class UpdateClock {
  constructor(worlds) {
    this.interval = Math.floor(1000 / 60);
    this.updates = {}
    this.worlds = worlds
    this.updateClock();
  }

  updateClock() {
  	var pinfo_t_SIZE = 4 + 4 + 1 + 1 + 1 + 1;
  	var pixupd_t_SIZE = 4 + 4 + 4 + 1 + 1 + 1;

  	for (var i in this.updates) {
  		var plupdates = this.updates[i][0];
  		var pxupdates = this.updates[i][1];
  		var plleft = this.updates[i][2];

  		var updSize = (1 + 1 + plupdates.length * (4 + pinfo_t_SIZE) +
  			2 + pxupdates.length * pixupd_t_SIZE +
  			1 + 4 * plleft.length);

  		//updSize += 2;

  		var upd = new Uint8Array(updSize);

  		upd[0] = protocol.server.worldUpdate;

  		var upd_dv = new DataView(upd.buffer);

  		var offs = 2;

  		var tmp = 0;
  		for (var u = 0; u < plupdates.length; u++) {
  			var client = plupdates[u];

  			upd_dv.setUint32(offs, client.id, true);
  			offs += 4;

  			upd_dv.setInt32(offs + 0, client.x, true);
  			upd_dv.setInt32(offs + 4, client.y, true);
  			upd_dv.setUint8(offs + 4 + 4, client.r);
  			upd_dv.setUint8(offs + 4 + 4 + 1, client.g);
  			upd_dv.setUint8(offs + 4 + 4 + 1 + 1, client.b);
  			upd_dv.setUint8(offs + 4 + 4 + 1 + 1 + 1, client.tool);

  			offs += pinfo_t_SIZE;
  			tmp++;
  		}

  		upd[1] = tmp;

  		upd_dv.setUint16(offs, pxupdates.length, true);

  		offs += 2;

  		for (var u = 0; u < pxupdates.length; u++) {
  			var client = pxupdates[u];

        upd_dv.setInt32(offs, u, true);
  			upd_dv.setInt32(offs + 4, client.x, true);
  			upd_dv.setInt32(offs + 4 + 4, client.y, true);
  			upd_dv.setUint8(offs + 4 + 4 + 4, client.r);
  			upd_dv.setUint8(offs + 4 + 4 + 4 + 1, client.g);
  			upd_dv.setUint8(offs + 4 + 4 + 4 + 1 + 1, client.b);

  			offs += pixupd_t_SIZE;
  		}
  		upd_dv.setUint8(offs, plleft.length); //upd_dv.setUint16(offs, plleft.length, true);

  		offs += 1;

  		for (var u = 0; u < plleft.length; u++) {
  			var id = plleft[u]; // this is a number
  			upd_dv.setUint32(offs, id, true);
  			offs += 4;
  		}

  		delete this.updates[i];

  		var wld = this.worlds.find(function(world) {return world.name == i}.bind(this));;
  		if (!wld) continue; // Shouldn't happen

  		var clients = wld.clients;

  		for (var c = 0; c < clients.length; c++) {
  			var client = clients[c];
  			var send = client.send;
  			send(upd)
  		}
    }
    setTimeout(function() {this.updateClock()}.bind(this), this.interval);
  }

  getUpdObj(world) {
  	world = world.toLowerCase();
  	if (!this.updates[world]) {
  		this.updates[world] = [
  			[],
  			[],
  			[]
  		];
  	}
  	return this.updates[world]
  }

  doUpdatePlayerPos(world, client) {
  	var upd = this.getUpdObj(world)[0];
  	upd.push(client)
  }

  doUpdatePixel(world, pixelData) {
    var upd = this.getUpdObj(world)[1];
  	upd.push(pixelData)
  }

  doUpdatePlayerLeave(world, id) {
  	var upd = this.getUpdObj(world)[2];
  	upd.push(id)
  }
}
module.exports = UpdateClock
