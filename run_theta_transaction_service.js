var schedule = require('node-schedule')
var Web3 = require('web3');
var bluebird = require("bluebird");
var fs = require('fs')
var theta_transaction_broadcaster = require('./jobs/theta_transaction_broadcaster.js')
var theta_transaction_verifier = require('./jobs/theta_transaction_verifier.js')
var api = require('./api/api.js')
var logger = require('./utils/logger.js')

//------------------------------------------------------------------------------
//  Global variables
//------------------------------------------------------------------------------
var config = null;
var configFileName = 'config.cfg'

//------------------------------------------------------------------------------
//  Start from here
//------------------------------------------------------------------------------
main();

//------------------------------------------------------------------------------
//  All implementation goes below
//------------------------------------------------------------------------------
function main() {
  // Initialize
  console.log('Loading config file: ' + configFileName)
  try {
    config = JSON.parse(fs.readFileSync(configFileName));
  } catch (err) {
    console.log('Error: unable to load ' + configFileName);
    console.log(err);
    process.exit(1);
  }
  console.log(config);

  api.SetConfig(config);
  bluebird.promisifyAll(api);

  var web3PrimaryNode = new Web3(new Web3.providers.HttpProvider(config.web3_primary_node));
  var web3SecondaryNode = new Web3(new Web3.providers.HttpProvider(config.web3_secondary_node));
  var web3Node = config.use_primary_node ? web3PrimaryNode : web3SecondaryNode;

  theta_transaction_broadcaster.Initialize(config, web3Node);
  theta_transaction_verifier.Initialize(config, web3Node);

  // start job
  schedule.scheduleJob(config.exe_freq.theta_transaction.broadcaster, theta_transaction_broadcaster.Execute);
  schedule.scheduleJob(config.exe_freq.theta_transaction.verifier, theta_transaction_verifier.Execute);
}
