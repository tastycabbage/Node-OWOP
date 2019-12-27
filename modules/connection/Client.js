const Bucket = require('./Bucket');

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
		this.stealth = false;
		this.serverRank = 0;
		this.send = function (data) {
			try {
				ws.send(data)
			} catch (e) {};
		};
		this.ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(",")[0].replace('::ffff:', '');
		this.world = "";
		this.pbucket = new Bucket(0, 0);
	}
	setPBucket() {

	}

};

module.exports = Client;
