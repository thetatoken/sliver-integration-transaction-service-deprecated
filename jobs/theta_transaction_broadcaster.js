var api = require('../api/api.js');
var logger = require('../utils/logger.js')


//------------------------------------------------------------------------------
//  Global variables
//------------------------------------------------------------------------------
const THETA = 'THETA';
const ETHER = 'ETHER';
const FIFTEENZEROS = '000000000000000';

var web3 = null;
var log = null;
var gas = null;
var lock = false;
var nonce = -1;
var used_nonce = -1
var nonce_lock_default = 30;
var nonce_lock = 0;


//------------------------------------------------------------------------------
//  All implementation goes below
//------------------------------------------------------------------------------
exports.Initialize = function(config, web3Node, callback) {
  config.log.service_name = 'theta_transaction_broadcaster';
  log = new logger.Logger(config.log);
  web3 = web3Node;
  gas = config.gas;
}

exports.Execute = function(callback) {
  if (lock) {
    log.Info('Skip..');
    return;
  }
  lock = true;
  var lockOwner = true; 

  api.GetNewThetaTransactionAsync()
  .then(function (transactionResult) {
    var result = JSON.parse(transactionResult);
    if (result.status == 'SUCCESS') {
      if (result.body.length > 0)
      {
        transaction_id_list = []
        send_value = 0;
        from_id = result.body[0].source == null? result.body[0].sender : result.body[0].source;
        to_id = result.body[0].recipient;
        token_type = result.body[0].token_type;

        for (var i = 0; i < result.body.length; i++) {
          from_id_temp = result.body[i].source == null? result.body[i].sender : result.body[i].source;
          to_id_temp = result.body[i].recipient;
          token_type_temp = result.body[i].token_type;
          if (from_id_temp == from_id && to_id_temp == to_id && token_type_temp == token_type) {
            log.Info('Batching transaction  ' + JSON.stringify(result.body[i]));
            transaction_id_list.push(result.body[i].id)
            send_value += result.body[i].tokens;
          }
        }

        // format token_type
        if (token_type == 'theta') {
          token_type = THETA;
          send_value_string = send_value.toString() + FIFTEENZEROS;
        } else {
          token_type = ETHER;
          send_value_string = send_value.toString(); // backend already pass in as wei
        }

        return api.GetAddressByUserIdAsync(from_id);
      } else {
        throw null;
      }
    } else {
      throw Error('Failed to fetch new transaction from backend.');
    }
  })
  .then(function (addressResult) {
    // get nonce from public key, then construct signing parameters
    var result = JSON.parse(addressResult);
    if (result.status == 'OK') {
      var from_address = result.body.address.startsWith('0x')? result.body.address : '0x' + result.body.address;
      log.Info('sender address: ' + from_address);

      nonce = web3.eth.getTransactionCount(from_address, 'pending');
      log.Info('nonce: ' + nonce)

      // nonce reuse check
      if (used_nonce == nonce && nonce_lock > 0) {
        // eventually this lock reduces to 0 and duplicated nonce can be used again
        // this is used in when transaction is dropped from node and we should retry with same nonce
        nonce_lock -= 1; 
        log.Info('nonce_lock: ' + nonce_lock.toString())
        throw Error('This nonce ' + used_nonce.toString() + ' was used in previous transactions. Wait for nonce to increase, or wearing out duplication lock .')
      }

      return api.GetSignedThetaTransactionDataAsync(from_id, to_id, send_value_string, nonce, gas.gas_price, gas.start_gas, token_type)
    } else {
      throw Error('Failed to get user ' + from_id + ' public address from key service.');
    }
  })
  .then(function (getSignedTransactionResult) {
    // send transaction to network
    var result = JSON.parse(getSignedTransactionResult);
    if (result.status == 'OK') {
      transaction_data = result.body.signed_transaction.startsWith('0x')? result.body.signed_transaction : '0x' + result.body.signed_transaction;
      log.Info('transaction data: ' + transaction_data);
      var transactionHash = web3.eth.sendRawTransaction(transaction_data);
      if (transactionHash == null || transactionHash == undefined) {
        throw Error('Failed to broadcast exchange rate transaction.')
      }
      log.Info('Send success. TransactionHash: ' + transactionHash.toString());
      
      // record nonce, and reset nonce_lock
      used_nonce = nonce;
      nonce_lock = nonce_lock_default;

      payload = {
        ids: transaction_id_list,
        // status: 'processing',  status is implicit on backend
        txhash: transactionHash.toString(),
        nonce: used_nonce
      }
      return api.BatchUpdateThetaTransactionAsync(JSON.stringify(payload))
      
    } else {
      throw Error('Failed to get transaction signed: ' + from_id + ' -> ' + to_id + ':' + sendValue.toString() + ':' + token_type);
    }
  })
  .then(function (updateTransactionResult) {
    var result = JSON.parse(updateTransactionResult);
    if (result.status == 'SUCCESS') {

      log.Info('Process transaction successful.')
      log.Info('===================================================')
      if (lockOwner) {
        lock = false;
      }


    } else {
      throw Error('Failed to report transaction processed to backend: ' + transaction_id_list.toStriong() + ': '+ from_id + ' -> ' + to_id + ':' + sendValue.toString() + ':' + token_type);
    }
  })
  .catch(function(error) {
    if (error != null) {
      log.Error(error.stack)
      log.Info('Process transaction failed.')
      log.Info('===================================================')
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


