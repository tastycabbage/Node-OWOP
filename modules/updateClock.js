class UpdateClock {
  constructor() {
    
  }
  function updateClock() {
  	var pinfo_t_SIZE = 4 + 4 + 1 + 1 + 1 + 1;
  	var pixupd_t_SIZE = 4 + 4 + 1 + 1 + 1;

  	for (var i in updates) {
  		var plupdates = updates[i][0];
  		var pxupdates = updates[i][1];
  		var plleft = updates[i][2];

  		var updSize = (1 + 1 + plupdates.length * (4 + pinfo_t_SIZE) +
  			2 + pxupdates.length * pixupd_t_SIZE +
  			1 + 4 * plleft.length);

  		//updSize += 2;

  		var upd = new Uint8Array(updSize);

  		upd[0] = UPDATE;

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

  			upd_dv.setInt32(offs, client.x, true);
  			upd_dv.setInt32(offs + 4, client.y, true);
  			upd_dv.setUint8(offs + 4 + 4, client.r);
  			upd_dv.setUint8(offs + 4 + 4 + 1, client.g);
  			upd_dv.setUint8(offs + 4 + 4 + 1 + 1, client.b);

  			offs += pixupd_t_SIZE;
  		}
  		upd_dv.setUint8(offs, plleft.length); //upd_dv.setUint16(offs, plleft.length, true);

  		offs += 1;

  		for (var u = 0; u < plleft.length; u++) {
  			var id = plleft[u]; // this is a number
  			upd_dv.setUint32(offs, id, true);
  			offs += 4;
  		}

  		delete updates[i];

  		var wld = worlds[i];
  		if (!wld) continue; // Shouldn't happen

  		var clients = wld.clients;

  		for (var c = 0; c < clients.length; c++) {
  			var client = clients[c];
  			var send = client.send;
  			send(upd)
  		}
  	}
  	setTimeout(updateClock, interval);
  }
  updateClock();

  function getUpdObj(world) {
  	world = world.toLowerCase();
  	if (!updates[world]) {
  		updates[world] = [
  			[],
  			[],
  			[]
  		];
  	}
  	return updates[world]
  }

  function doUpdatePlayerPos(world, client) {
  	var upd = getUpdObj(world)[0];
  	upd.push(client)
  }

  function doUpdatePixel(world, pixelData) {
  	var upd = getUpdObj(world)[1];
  	upd.push(pixelData)
  }

  function doUpdatePlayerLeave(world, id) {
  	var upd = getUpdObj(world)[2];
  	upd.push(id)
  }
}
module.exports = UpdateClock
