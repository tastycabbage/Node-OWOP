var config = require("../../config");
const permissions = require("./permissions.js")
class Commands {
  constructor(chat, client, world, worlds, manager) {
    chat = chat.substr(1);
    this.world = world
    this.worlds = worlds
    this.manager = manager
    this.command = chat.split(" ")[0];
    this.args = chat.split(" ");
    this.args.shift();
    this.client = client;
    if(typeof this[this.command] == "function") {
      if(this[this.command](true)) { //hacky solution :D
        this[this.command]() //hacky solution :D
      } else {
        this.client.send("Command not recognized!")
      }
    } else {
      this.client.send("Command not recognized!")
    }

  }
  adminlogin(checking) {
    if(checking) {
        return this.client.rank >= permissions.none
    }
    var password = this.args.join(" ")
    if(password == config.adminlogin) {
      this.client.setRank(permissions.admin)
      this.client.send("Server: You are now an admin. Do /help for a list of commands.")
    } else {
      this.client.send("Wrong password.")
    }
  }
}
module.exports = Commands
