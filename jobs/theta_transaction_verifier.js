var api = require('../api/api.js');
var logger = require('../utils/logger.js')


//------------------------------------------------------------------------------
//  Global variables
//------------------------------------------------------------------------------
var web3 = null;
var log = null;
var blocksNeeded = 5; // will be overwritten by config
var lock = false;

//------------------------------------------------------------------------------
//  All implementation goes below
//------------------------------------------------------------------------------
exports.Initialize = function(config, web3Node, callback) {
  config.log.service_name = 'theta_transaction_verifier';
  log = new logger.Logger(config.log);
  web3 = web3Node;
  blocksNeeded = config.blocks_to_confirm;
}

exports.Execute = function(callback) {
  if (lock) {
    log.Info('Skip..');
    log.Info('===================================================');
    return;
  }
  lock = true;
  var lockOwner = true; 

  api.GetProcessingThetaTransactionAsync()
  .then(function (transactionResult) {
    var result = JSON.parse(transactionResult);
    if (result.status == 'SUCCESS') {
      if (result.body.length > 0) {
        transaction = result.body[0];
        xact_id = transaction.id;
        xact_hash = transaction.txhash;
        xact_nonce = transaction.nonce;
        xact_sender_id = transaction.source == null? transaction.sender : transaction.source;
        
        log.Info('processed transaction: ' + xact_id + ' : ' +  xact_sender_id + ' -> ' + transaction.recipient + ' : ' + xact_hash + ' : ' + xact_nonce.toString())
        return api.GetAddressByUserIdAsync(xact_sender_id);
      } else {
        throw null;
      }
    } else {
      throw Error('Failed to fetch transactions from backend');
    }
  })
  .then(function (addressResult) {
    var result = JSON.parse(addressResult);
    if (result.status == 'OK') {
      var xact_sender_address = result.body.address.startsWith('0x')? result.body.address : '0x' + result.body.address;
      log.Info('sender address: ' + xact_sender_address);

      // starts to validate transaction
      if (xact_hash == null) {
        log.Info('Invalid xact_hash retrived from backend. Marking transaction as error.');
        payload = {
          status: 'error'
        }
        return api.UpdateThetaTransactionAsync(xact_id, JSON.stringify(payload))
      }

      var receipt = web3.eth.getTransactionReceipt(xact_hash);
      if (receipt == null) {

        // if confirmed_nonce is higher than or equal to xact_nonce, and still no receipt is present, then transaction is dropped
        confirmed_nonce = web3.eth.getTransactionCount(xact_sender_address);
        if (confirmed_nonce > xact_nonce + 1) {
          drop_message = 'Transaction dropped from node. Marking transaction as error. Dropped tx hash: ' + xact_hash;
          log.Info(drop_message);
          api.SendSlackMessage(log.ServiceName(), drop_message, null, function(err) {if (err!=null) {log.Error('Send slack message failed.')}});

          payload = {
            status: 'error'
          }
          return api.UpdateThetaTransactionAsync(xact_id, JSON.stringify(payload))
        }
        else {
          log.Info(xact_hash + ' is not confirmed yet.')
          throw null;
        }
      } else {
        var currentBlock = web3.eth.blockNumber;
        var receiptBlock = receipt.blockNumber;
        log.Info((currentBlock - receiptBlock + 1).toString() + ' blocks has confirmed this transaction.')
        if (currentBlock - receiptBlock + 1 >=  blocksNeeded) {

          confirmed_status = (receipt.status == '0x1') ? 'success' : 'error';
          payload = {
            status: confirmed_status
          }
          log.Info('Confirmed on blockchain. Marking transaction as ' + confirmed_status);
          return api.UpdateThetaTransactionAsync(xact_id, JSON.stringify(payload))
        } else {
          throw null;
        } 
      }
    } else {
      throw Error('Failed to get user ' + xact_sender_id + ' public address from key service.');
    }
  })
  .then(function (updateTransactionResult) {
    var result = JSON.parse(updateTransactionResult);
    if (result.status == 'SUCCESS') {

      log.Info('Transaction updated .');
      log.Info('===================================================');
      if (lockOwner) {
        lock = false;
      }

    } else {
      throw Error('Failed to report to backend: ' + xact_id);
    }
  })
  .catch(function(error) {
    if (error != null) {
      log.Error(error.stack);
      log.Info('Update transaction failed.')
      log.Info('===================================================');
      api.SendSlackMessage(log.ServiceName(), error.message, null, function(err) {if (err!=null) {log.Error('Send slack message failed.')}});
    }

    if (lockOwner) {
      lock = false;
    }

    if (callback != null) {
      callback(error, null);    
    }
  });
}



