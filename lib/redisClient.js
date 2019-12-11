var redis = require('redis');
var config = require('../config').redis;

var log = require('log4js').getLogger('redisClient');

const expire_time = 30;

var redisClient = redis.createClient(config.port, config.host);

redisClient.on('error', function (err) {
  log.error('Redis Error: ' + err);
});

module.exports = redisClient;

redisClient.getPrevious = getPrevious;
function getPrevious (tId) {
  return new Promise(function (resolve, reject) {
    var previous = [];
    redisClient.exists(tId + ':0', function (err, exist) {
      if (err) reject(err);
      if (!exist) {
        resolve(previous);
      }
      redisClient.get(tId + ':0', function (err0, data0) {
        if (err0) reject(err0);
        redisClient.get(tId + ':1', function (err1, data1) {
          if (err1) reject(err1);
          try {
            previous.push(JSON.parse(data0));
            previous.push(JSON.parse(data1));
            resolve(previous);
          } catch (p_err) {
            reject(p_err);
          }
        });
      });
    });
  });
}

redisClient.insertResults = insertResults;
function insertResults (results) {
  return new Promise(function (resolve, reject) {
    var actions = [];
    for (let tId in results.tags) {
      actions.push(insertData(results.tags, tId));
    }
    Promise.all(actions).then(function () {
      try {
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

function insertData (tags, tId) {
  return new Promise(function (resolve, reject) {
    redisClient.exists(tId + ':1', function (err, exist) {
      if (err) reject(err);
      let data1 = JSON.stringify(tags[tId]);
      if (!exist) {
        redisClient.setex(tId + ':1', expire_time, data1, function (err1, success) {
          if (err1) reject(err1);
          log.debug('set ' + tId + ':1 for ' + data1);
          resolve();
        });
      }
      redisClient.get(tId + ':1', function (g_err, data0) {
        if (g_err) reject(g_err);
        redisClient.setex(tId + ':0', expire_time, data0, function (err0, success) {
          if (err0) reject(err0);
          redisClient.setex(tId + ':1', expire_time, data1, function (err1, success) {
            if (err1) reject(err1);
            log.debug('set ' + tId + ':0 for ' + data0);
            log.debug('set ' + tId + ':1 for ' + data1);
            resolve();
          });
        });
      });
    });
  });
}