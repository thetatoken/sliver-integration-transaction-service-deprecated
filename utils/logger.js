var fs = require('fs')

//------------------------------------------------------------------------------
//  Global variables
//------------------------------------------------------------------------------

//------------------------------------------------------------------------------
//  Implementation
//------------------------------------------------------------------------------
exports.Logger = function(config) {

  var now = new Date();
  var fileCount = 0;
  var lineCount = 0;

  //console.log("Config: \n" + JSON.stringify(config, null, '\t'));

  var linesPerFile = (config.lines_per_file != undefined)? config.lines_per_file : 3000;
  //console.log("Lines Per File: " + linesPerFile);

  var enableConsoleLog = (config.enable_console_log != undefined)? config.enable_console_log : 0;
  //console.log("Enable Console Log: " + enableConsoleLog);

  var printTimeToConsole = (config.print_time_to_console != undefined)? config.print_time_to_console : 0;
  //console.log("Print Time To Console: " + printTimeToConsole);

  MakeSurePathExist(config.path + "/");
  var service_name = config.service_name;
  var filename = MakeLogFileName(now, config.path, config.service_name, fileCount);
  this.file = fs.createWriteStream(filename, { 'flags': 'w', 'encoding': 'utf8', 'mode':0644 });

  this.ServiceName = function() {
    return service_name;
  }

  this.Info = function(msg) {
    this.Write("[" + service_name + "][Info]" + msg)
  }

  this.Error = function(msg) {
    this.Write("[" + service_name + "][Error]" + msg)
  }

  this.Write = function(msg) {
    var now = new Date();
    var time = now.toISOString().replace(/[T\.]/g, ' ').replace(/Z/, '');
    this.file.write("[" + time + "] ");
    this.file.write(msg);
    this.file.write("\r\n");

    lineCount++;
    if(lineCount > linesPerFile) {
      fileCount++;
      lineCount = 0;
      this.CreateNewFile();
    }

    if(enableConsoleLog) {
      var line = (printTimeToConsole) ? "[" + time + "] " + msg : msg;
      console.log(line);
    }
  }

  this.CreateNewFile = function() {
    if(this.file != null) {
      this.file.end();
    }

    var filename = MakeLogFileName(now, config.path, config.service_name, fileCount);
    this.file = fs.createWriteStream(filename, { 'flags': 'w', 'encoding': 'utf8', 'mode':0644 });
  }

  console.log("Logger is ready - " + filename);
}

//------------------------------------------------------------------------------
//  Utils
//------------------------------------------------------------------------------

function To2Digit(value) {
  if(value < 10) {
    return "0" + value;
  }
  return value;
}

function MakeSurePathExist(path) {
  if (!fs.existsSync(path)){
    fs.mkdirSync(path);
  }
}

function MakeLogFileName(date, path, name, count) {
  var now = date;
  var year = 1900 + now.getYear();
  var month = To2Digit(now.getMonth() + 1);
  var date = To2Digit(now.getDate());
  var hour = To2Digit(now.getHours());
  var min = To2Digit(now.getMinutes());
  var index = To2Digit(count);
  return path + "/" + name + "_" + year + "-" + month + "-" + date + "_" + hour + "-" + min + "("+ index + ").txt";
};
