require("./client.js")

const fs = require("fs");
const ws = require("ws");
const request = require("request");
const EventEmitter = require("events");

const Connection = require('./modules/Connection.js');
const UpdateClock = require("./modules/server/UpdateClock.js")
const manager = require("./modules/server/manager.js")
var bansIgnore = false;
var wss;
var config = require("./config.json");
var terminatedSocketServer = false;
const ConfigManager = require("./modules/server/ConfigManager.js")
const BansManager = require("./modules/server/BansManager.js")
const proxy_check = require('proxycheck-node.js');


global.server = {
  chalk: require("chalk"),
  worlds: [],
  bans: require("./bans.json"),
  config,
  updateClock: new UpdateClock(),
  manager,
  events: new EventEmitter(),
  loadedScripts: [],
  disabledScripts: [],
  ConfigManager,
  bansManager: new BansManager(),
  players: require("./modules/connection/player/players.js"),
  antiProxy: new proxy_check({
    api_key: config.antiProxy.key
  })
};

server.events.on("savedWorlds", function() {
  console.log("Saved Worlds")
  server.players.sendToAll("DEVSaved Worlds", 3) //3 means rank (admin)
})

function loadScripts() {
  fs.readdirSync("./scripts").forEach(file => {
    if (!file.startsWith("-") && file.endsWith(".js")) {
      let script = require("./scripts/" + file);
      if (typeof script.name == "string" && typeof script.version == "string" && typeof script.install == "function") {
        script.install()
        console.log(server.chalk.green(`Loaded script ${script.name} version ${script.version}`))
        server.loadedScripts.push(file)
      } else {
        console.error(server.chalk.red(`Script ${file} doesn't follow syntax!`))
        server.disabledScripts.push(file)
      }
    }
  });
}
loadScripts()


function createWSServer() {
  wss = new ws.Server({
    port: config.port
  });
  wss.on("connection", async function(ws, req) {
    if (terminatedSocketServer) {
      ws.send(config.closeMsg)
      ws.close();
    }
    let ip = (req.headers['x-forwarded-for'] || req.connection.remoteAddress).split(",")[0].replace('::ffff:', '');

    if (server.bansManager.checkIfIsBanned(ip)) {
      let ban = server.bansManager.bans[ip]
      if (!isNaN(ban.duration)) {
        let banString = server.bansManager.generateString(server.bansManager.banEndsAfter(ip))
        ws.send(`${server.config.messages.unbanMessage}\nYou are banned for ${banString}\nReason: ${ban.reason}`);
      } else {
        ws.send(`${server.config.messages.unbanMessage}\nYou are permanently banned!\nReason: ${ban.reason}`);
      }
      ws.close();
      return;
    }
    if (server.config.maxConnections > 0) {
      if (server.players.getAllPlayers().length >= server.config.maxConnections) { //yes ik about that if there is many players this is slow method... or not?
        ws.send("Reached max connections limit")
        ws.close();
        return;
      }
    }
    if (server.config.maxConnectionsPerIp > 0) {
      if (server.players.getAllPlayersWithIp(ip).length >= server.config.maxConnectionsPerIp) { //its equal cuz this client isn't in any world
        ws.send("Reached max connections per ip limit")
        ws.close();
        return;
      }
    }
    if (config.antiProxy.enabled) {
      let result = await server.antiProxy.check(ip, {
        vpn: server.config.antiProxy.vpnCheck,
        limit: server.config.antiProxy.limit
      });
      if (result.status == "denied" && result.message[0] == "1") {
        console.log(server.chalk.red("Check your dashboard the queries limit reached!"))
      }
      if (result.error || !result[ip]) return;
      if (result[ip].proxy == "yes") {
        ws.close()
        server.bansManager.addBanIp(ip, "Proxy!", 0)
      }
    }

    new Connection(ws, req);
  });
}

function beginServer() {
  createWSServer()
  console.log("Server started. Type /help for help")
}
var rl = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout
});
//server controler
if (process.platform === "win32") {
  rl.on("SIGINT", function() {
    process.emit("SIGINT");
  });
}
async function exit() {
  console.log("Exiting...");
  for (var w in server.worlds) {
    var world = server.worlds[w];
    for (var c = 0; c < world.clients.length; c++) {
      var client = world.clients[c];
      client.send(config.messages.closeMsg);
    }
  }
  await server.manager.close_database()
  process.exit()
}
process.on("SIGINT", exit)
process.on("beforeExit", exit);
var serverOpNick = "";
var serverOpRank = 3;
rl.on("line", function(d) {
  var msg = d.toString().trim();
  if (terminatedSocketServer) return;
  if (msg.startsWith("/")) {
    var cmdCheck = msg.slice(1).split(" ");
    cmdCheck[0] = cmdCheck[0].toLowerCase();
    var argString = cmdCheck.slice(1).join(" ").trim();
    cmdCheck.filter(x => x);
    if (cmdCheck[0] == "help") {
      console.log("/help - Lists all commands.");
      console.log("/stop, /kill - Closes the server.");
      console.log("/js, /eval <code> - Evaluates the given code.");
      console.log("/nick <nick> - Changes your nick.");
      console.log("/rank <user|moderator|admin|server|tell|discord> - Changes your rank. (Only affects messages.)");
    } else if (cmdCheck[0] == "kill" || cmdCheck[0] == "stop") {
      exit()
    } else if (cmdCheck[0] == "eval" || cmdCheck[0] == "js") {
      try {
        console.log(String(eval(argString)));
      } catch (e) {
        console.log(e);
      }
    } else if (cmdCheck[0] == "nick") {
      serverOpNick = argString;
      if (argString) {
        console.log("Nickname set to: '" + argString + "'");
      } else {
        console.log("Nickname reset.");
      }
    } else if (cmdCheck[0] == "rank") {
      var rankIndex = ["user", "moderator", "admin", "server", "tell", "discord"].indexOf(cmdCheck[1].toLowerCase())
      if (~rankIndex) {
        serverOpRank = rankIndex;
        console.log("Set rank to " + cmdCheck[1].toLowerCase() + ".");
      } else {
        console.log("Usage: /rank <user|moderator|admin|server|tell|discord>")
      }
    }
  } else {
    function sendToWorlds(msg) {
      for (var gw in server.worlds) {
        var worldCurrent = server.worlds[gw];
        var clientsOfWorld = worldCurrent.clients;
        for (var s = 0; s < clientsOfWorld.length; s++) {
          var sendToClient = clientsOfWorld[s].send;
          sendToClient(msg);
        }
      }
    }
    sendToWorlds((serverOpNick && ["[0] ", "", " ", "[Server] "][serverOpRank] || ["", "(M) ", "(A) ", "Server", "-> ", "[D] "][serverOpRank]).trimLeft() + (serverOpNick || (serverOpRank == 3 ? "" : "0")) + ": " + msg);
  }
});
beginServer()
