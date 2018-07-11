var api = require('../api/api.js');

exports.GetNewThetaTransaction = function(callback) {
    var allXacts = [];
    getAllThetaXacts(allXacts, null, () => {
        var nextBatch = prepareThetaXacts(allXacts);

        if (confirmUniqueness(nextBatch)) {
            callback(null, JSON.stringify({ status: 'SUCCESS', body: nextBatch }));
        } else {
            callback('Next batch has duplicate xacts in it', null);
        }
    });
}

function totalTokens(xacts) {
    var amount = 0;
    for (var i = 0; i < xacts.length; i++) {
        amount += xacts[i].tokens;
    }
    return amount;
}

function getAllThetaXacts(allXacts, anchor, cb){
    api.GetPaginatedThetaTransactionAsync(anchor).then(function(transactionResult){
        var result = JSON.parse(transactionResult);
        if (result.status !== 'SUCCESS') {
            cb();
            return;
        }

        console.log('Adding ' + result.body.length + ' more xacts to list. First: ' + result.body[0].id + ' last: ' + result.body[result.body.length - 1].id);
        for (var i = 0; i < result.body.length; i++){
            allXacts.push(result.body[i]);
        }

        if (result.body.length == 100){
            setTimeout(function () {
                getAllThetaXacts(allXacts, result.body[99].id, cb);
            }, 100);
        } else {
            cb();
        }
    });
}

function prepareThetaXacts(allXacts) {
    var xacts = [];
    var batches = {};
    for (var i = 0; i < allXacts.length; i++) {
        switch (allXacts[i].type) {
            case "gift":
                if (!batches[allXacts[i].recipient]) {
                    batches[allXacts[i].recipient] = [];
                }
                batches[allXacts[i].recipient].push(allXacts[i]);
                break;
            case "withdraw":
            case "gas":
                xacts.push(allXacts[i]);
                break;
        }
    }

    if (xacts.length > 0) {
        return xacts; // prioritize withdraw and gas transactions
    }

    var sortedBatches = Object.keys(batches).map(function(key) {
        return [key, { xacts: batches[key].length, tokens: totalTokens(batches[key]) }];
    });
    sortedBatches.sort(function (first, second) {
        return second[1].tokens - first[1].tokens;
    });

    console.log(JSON.stringify(sortedBatches));

    if (sortedBatches.length > 0) {
        if (sortedBatches[0][1].tokens > 100000) { // restrict it to only process xacts if receiver is receiving more than 100 theta
            return batches[sortedBatches[0][0]];
        }
    }

    return [];
}

function confirmUniqueness(batchedXacts) {
    var xactIds = [];
    for (var i = 0; i < batchedXacts.length; i++){
        if (xactIds.indexOf(batchedXacts[i].id) == -1) {
            xactIds.push(batchedXacts[i].id);
        } else {
            console.log('WARNING: ' + batchedXacts[i].id + ' was already in the list');
            return false;
        }
    }
    return true;
}

