const Bucket = require('./Bucket');
const protocol = require("./protocol.js");
const permissions = require("./permissions.js")
var config = require("../../config");
class Client {
	constructor(ws, req) {
		this.ws = ws;
		this.req = req;
		this.x_pos =  0;
		this.y_pos = 0;
		this.col_r = 0;
		this.col_g = 0;
		this.col_b = 0;
		this.tool = 0;
		this.id = 0;
		this.nick = "";
		this.send = function(data) {
			try {
				ws.send(data);
			} catch (e) {};
		}
		this.stealth = false;
		this.rank = 0;
		this.ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(",")[0].replace('::ffff:', '');
		this.world = "";
		this.pixelBucket = new Bucket(0, 0);
		this.chatBucket = new Bucket(0, 0);
	}
	setPixelBucket(rate, per) {
		this.pixelBucket = new Bucket(rate, per);
		var quota = new Uint8Array(5)
		var quota_dv = new DataView(quota.buffer);
		quota_dv.setUint8(0, protocol.server.setPQuota);
		quota_dv.setUint16(1, rate, true);
		quota_dv.setUint16(3, per, true);
		this.send(quota);
	}
	setChatBucket(rate, per) {
		this.chatBucket = new Bucket(rate, per)
	}
	setRank(rank) {
		this.send(new Uint8Array([protocol.server.setRank, rank]))
		this.rank = rank
		var rankName;
		for(var i in permissions) {
			if(permissions[i] == rank) {
				rankName = i
			}
		}
		var pixelBucket = config.bucket.pixel[rankName]
		var chatBucket = config.bucket.chat[rankName]
		this.setPixelBucket(pixelBucket[0], pixelBucket[1])
		this.setChatBucket(chatBucket[0], chatBucket[1])
	}
	setId(id) {
		this.id = id
		var id = new Uint8Array(5);
		var id_dv = new DataView(id.buffer);
		id_dv.setUint8(0, protocol.server.setId);
		id_dv.setUint32(1, this.id, true);
		this.send(id)
	}

};

module.exports = Client;
