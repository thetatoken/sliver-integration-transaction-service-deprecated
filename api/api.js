var http = require("http")
var https = require("https")


//------------------------------------------------------------------------------
//  Global variables
//------------------------------------------------------------------------------
var config = null;

//------------------------------------------------------------------------------
//  APIs
//------------------------------------------------------------------------------
exports.SetConfig = function(cfg) {
  config = cfg;
}

// theta transacion
exports.GetNewThetaTransaction = function(callback) {
  ProcessHttpRequest(config.private_api_host, config.private_api_port, 'GET', '/v1/theta_xact/list?status=created&number=1000', '', callback);
}

exports.GetProcessingThetaTransaction = function(callback) {
  ProcessHttpRequest(config.private_api_host, config.private_api_port, 'GET', '/v1/theta_xact/list?status=processing', '', callback);
}

exports.UpdateThetaTransaction = function(xactId, body, callback) {
  ProcessHttpRequest(config.private_api_host, config.private_api_port, 'PUT', '/v1/theta_xact/' + xactId, body, callback);
}

exports.BatchUpdateThetaTransaction = function(body, callback) {
  ProcessHttpRequest(config.private_api_host, config.private_api_port, 'PUT', '/v1/theta_xact/batch_process', body, callback);
}

exports.GetAddressByUserId = function(userId, callback) {
  ProcessHttpRequest(config.key_service_api_host, config.key_service_api_port, 'GET', '/address/' + userId, '', callback);
}

exports.GetSignedThetaTransactionData = function(fromId, toId, value, nonce, gasPrice, startGas, tokenType, callback) {
  params = '?from=' + fromId + '&to=' + toId + '&nonce=' + nonce + '&gas_price=' + gasPrice + '&start_gas=' + startGas + '&value=' + value + '&token_type=' + tokenType;
  ProcessHttpRequest(config.key_service_api_host, config.key_service_api_port, 'GET', '/transaction/sign' + params, '', callback);
}

// whitelist service
exports.GetNewWhitelistAccount = function(callback) {
  ProcessHttpRequest(config.whitelist_queue_api_host, config.whitelist_queue_api_port, 'GET', '/whitelist/transactions?status=created', '', callback);
}

exports.GetProcessingWhitelistAccount = function(callback) {
  ProcessHttpRequest(config.whitelist_queue_api_host, config.whitelist_queue_api_port, 'GET', '/whitelist/transactions?status=processing', '', callback);
}

exports.UpdateWhitelistAccount = function(body, callback) {
  ProcessHttpRequest(config.whitelist_queue_api_host, config.whitelist_queue_api_port, 'PUT', '/whitelist/transactions', body, callback);
}

exports.GetSignedWhitelistAccountData = function(addressList, nonce, gasPrice, startGas, callback) {
  params = '?';
  for (var i = 0; i < addressList.length; i++) {
    if (params != '?') {
      params += '&';
    }
    params += ('address=' + addressList[i]);
  }
  params +='&nonce=' + nonce + '&gas_price=' + gasPrice + '&start_gas=' + startGas;
  ProcessHttpRequest(config.token_sale_tx_signer_api_host, config.token_sale_tx_signer_api_port, 'GET', '/whitelist/sign' + params, '', callback);
}

// exchange rate update service
exports.GetCurrentEthPrice = function(callback) {
  ProcessHttpsRequest(config.gdax_api_host, config.gdax_api_port, 'GET', '/products/ETH-USD/ticker', '', callback);
}

exports.CreateExchangeRateHistory = function(body, callback) {
  ProcessHttpRequest(config.whitelist_queue_api_host, config.whitelist_queue_api_port, 'POST', '/exchange_rate/transaction', body, callback);
}

exports.GetProcessingExchangeRateHistory = function(callback) {
  ProcessHttpRequest(config.whitelist_queue_api_host, config.whitelist_queue_api_port, 'GET', '/exchange_rate/transactions?status=processing', '', callback);
}

exports.UpdateExchangeRateHistory = function(body, callback) {
  ProcessHttpRequest(config.whitelist_queue_api_host, config.whitelist_queue_api_port, 'PUT', '/exchange_rate/transaction', body, callback);
}

exports.GetSignedExchangeRateData = function(rate, nonce, gasPrice, startGas, callback) {
  params = '?exchange_rate=' + rate + '&nonce=' + nonce + '&gas_price=' + gasPrice + '&start_gas=' + startGas;
  ProcessHttpRequest(config.token_sale_tx_signer_api_host, config.token_sale_tx_signer_api_port, 'GET', '/exchange_rate/sign' + params, '', callback);
}

// slack bot
exports.SendSlackMessage = function(service_name, message, body, callback) {
  payload = {
    title: service_name,
    text: message,
    fields: body
  }
  ProcessHttpRequest(config.slack_bot_host, config.slack_bot_port, 'POST', '/v1/slack/blockchain/error', JSON.stringify(payload), callback);
}


//------------------------------------------------------------------------------
//  Utils
//------------------------------------------------------------------------------

var ProcessHttpRequest = function(host, port, method, path, requestBody, callback) {
  ProcessRequest(host, port, method, path, requestBody, false, callback);
}

var ProcessHttpsRequest = function(host, port, method, path, requestBody, callback) {
  ProcessRequest(host, port, method, path, requestBody, true, callback);
}

var ProcessRequest = function(host, port, method, path, requestBody, useHttps, callback) {

  var options = {
    host: host,
    port: port,
    method: method,
    path: path,
    headers: {'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(requestBody), 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.84 Safari/537.36'}
  };
  if (config.log.log_level == 'debug'){
    console.log('[Debug] ____');
    console.log('[Debug] Http request: ' + JSON.stringify(options));    
    console.log('[Debug] ' + requestBody);
  }

  http_client = useHttps? https : http;
  
  try {
    var req = http_client.request(options, function(res) { 
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function(dataBlock) {
        body += dataBlock;
      });
      res.on('end', function() {
        if (config.log.log_level == 'debug'){
          console.log('[Debug]' + body);
          console.log('[Debug] ____');
        }

        if (callback) { callback(null, body); }
      });
    });

    req.setTimeout(10000, function() {
      req.abort();
      callback('Request Timeout: ' + path, null);
      callback = null;
    });

    req.on('error', function(error) {
      console.log('req error: ' + error)
      if (callback) { callback(error, null); }
    });

    req.write(requestBody);
    req.end();
  }
  catch(error) {
    callback(error.stack, null);
  }
}