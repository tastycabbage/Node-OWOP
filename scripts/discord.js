//module by mathias377
//I don't know why but in glitch you need wait some time when folder with config will show 
module.exports = (() => {
  const Discord = require("discord.js");
  let name = "Discord Gateway"
  let version = "1.0.4"

  function install() {
    let config = new server.ConfigManager(name, {
      guildId: "",
      channelId: { //channelId: world
        "": "main"
      },
      botToken: "",
      botControlRole: "",
    }).config

    const bot = new Discord.Client({
      disableEveryone: true
    });
    server.bot = bot;

    function getKeyByValue(object, value) {
      for (var prop in object) {
        if (object.hasOwnProperty(prop)) {
          if (object[prop] === value)
            return prop;
        }
      }
      return false;
    }
    bot.on("message", async (message) => {
      if (config.channelId[message.channel.id]) {
        if (message.author.bot) return;
        if (message.channel.type === "dm") return;

        let world = server.worlds.find(function(world) {
          return world.name == config.channelId[message.channel.id]
        });
        if (world) {
          world.sendToAll(`[D] ${message.author.username}: ${message.content}`)
        }
      }
    });
    server.events.on("chat", function(client, msg) {
      var channelId = getKeyByValue(config.channelId, client.world)
      if (channelId == false) return;
      if (client.rank != 3) msg = msg.replace(/<@.!?([0-9]+)>/g, "(here ping)");
      let before = client.before.replace(/<(?:alt=("|')(.+?)\1|.|\n)+>/gm, "$2");
      bot.guilds.get(config.guildId).channels.get(channelId).send(`${before}: ${msg}`)
    })
    bot.login(config.botToken);
  }
  return {
    install,
    name,
    version
  }
})()
