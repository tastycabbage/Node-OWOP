const fs = require("fs")
let path = "./scripts/"
class ConfigManager { //its shitty
  constructor(script, defaultConfig) {
    this.script = script;
    this.config = {};
    this.defaultConfig = defaultConfig
    setInterval(function() {
      this.write(this.config)
    }.bind(this),1000)
    if(this.pathAndFileExists()) {
      this.load()
    } else {
      this.write(this.defaultConfig)
      this.config = this.defaultConfig
    }
  }
  pathAndFileExists() {
    return this.dirExists() && this.configExist();
  }
  configExist() {
    return fs.existsSync(path + this.script + "/config.json");
  }
  mkDir() {
    fs.mkdirSync(path + this.script)
  }
  dirExists() {
    return fs.existsSync(path + this.script);
  }
  write(config = {}) {
    if(!this.dirExists()) this.mkDir()
    fs.writeFileSync(path + this.script + "/config.json", JSON.stringify(config, null, 2), function(err) {
      if (err) console.log(err);
    });
  }
  load() {
    this.config = JSON.parse(fs.readFileSync(path + this.script + "/config.json").toString())
  }
}
module.exports = ConfigManager
