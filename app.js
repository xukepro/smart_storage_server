var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var https = require('https');
var locationManager = require('./lib/locationManager');

var config = require('./config');
var log4js = require('log4js');
log4js.configure(config.log4js);
var wsConnection = require('./lib/wsConnection');
var RedisClient = require('./lib/redisClient');
var MongoClient = require('./lib/mongoClient');

var mongoClient = new MongoClient();

var redisKey = config.redis.sortedSet.key;
var offset = config.redis.sortedSet.offset;
var loadTimeInterval = config.redis.sortedSet.loadTimeInterval;
var deleteTimeInterval = config.redis.sortedSet.deleteTimeInterval;
var Evaluator = require('./lib/utils').evaluator;
var evaluator = new Evaluator('evaluate.txt');

var logger = log4js.getLogger('startup');

var log = log4js.getLogger('cycLoad');

var httpServers = [];

var http_server = http.createServer(function (request, response) {
  logger.info('HTTP Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
http_server.listen(config.http_port, function () {
  logger.info('HTTP Server is listening on port ' + config.http_port);
});
httpServers.push(http_server);

if (Object.prototype.hasOwnProperty.call(config, 'https_port')
  && Object.prototype.hasOwnProperty.call(config, 'sec')) {
  let options = { key: config.sec.key, cert: config.sec.crt };
  var https_server = https.createServer(options, function (request, response) {
    logger.info('HTTPS Received request for ' + request.url);
    response.writeHead(404);
    response.end();
  });
  https_server.listen(config.https_port, function () {
    logger.info('HTTPS Server is listening on port ' + config.https_port);
  });
  httpServers.push(https_server);
}

var wssServer = new WebSocketServer({
  httpServer: httpServers,
  autoAcceptConnections: false
});

var router = new WebSocketRouter();
router.attachServer(wssServer);

router.mount('/app', 'echo-protocol', request => require('./routes/app')(request, wsConnection));
router.mount('/root', 'echo-protocol', request => require('./routes/root')(request, wsConnection, mongoClient));
router.mount('/map', 'echo-protocol', request => require('./routes/map')(request, wsConnection));

const cyclicLoad = (loadTimeInterval) => {

  evaluator.cyclic();

  let time = Date.now() / 1000;
  let timeRange = [time - loadTimeInterval / 1000 - offset / 1000, time - offset / 1000];

  evaluator.record();
  return RedisClient.zrangebyscore(redisKey, ...timeRange, 'WITHSCORES', function (err, response) {
    if (err) {
      log.error(err);
      return;
    }
    if (response.length === 0) {
      log.trace('load 0 item');
      return;
    }

    evaluator.record();

    log.diag('load data: ', response);

    let i = 0,
      res,
      tidied_json = {
        timestamp: time - offset / 1000,
        tags: {}
      };

    while (i < response.length) {
      try {
        res = JSON.parse(response[i]);
      } catch (err) {
        log.error(err);
        return;
      }

      for (let item of res.tags) {

        if (!Object.prototype.hasOwnProperty.call(tidied_json.tags, item.tId)) {
          tidied_json.tags[item.tId] = [[res.aId, item.rssi]];
        } else {
          let len = tidied_json.tags[item.tId].length;
          //将新数据加入有序数组
          if (item.rssi > tidied_json.tags[item.tId][0][1]) {
            tidied_json.tags[item.tId].unshift([res.aId, item.rssi]);
          } else if (item.rssi < tidied_json.tags[item.tId][len - 1][1]) {
            tidied_json.tags[item.tId].push([res.aId, item.rssi]);
          } else {
            for (let j = 0; j < len - 1; j++) {
              if (item.rssi < tidied_json.tags[item.tId][j][1] && item.rssi > tidied_json.tags[item.tId][j + 1][1]) {
                tidied_json.tags[item.tId].splice(j + 1, 0, [res.aId, item.rssi]);
              }
            }
          }
        }
      }
      i = i + 2;
    }
    log.debug(JSON.stringify(tidied_json));

    evaluator.record();

    let results = { 'n': 0, 'tags': {} };
    var actions = [];
    for (let tId in tidied_json.tags) {
      var anchors = tidied_json.tags[tId];
      if (anchors.length >= 3) {
        // anchors.sort(keysort('rssi', true));
        var input = { 'data': anchors, 'timestamp': tidied_json.timestamp };
        actions.push(
          locateForTag(tId, input)
            .then(function (result) {
              if (Object.prototype.hasOwnProperty.call(result, 'pos')) {
                result.pos = [
                  Number(Number(result.pos[0]).toFixed(6)),
                  Number(Number(result.pos[1]).toFixed(6))
                ];
                result.DOP = Number(Number(result.DOP).toFixed(6));
                result.weight = Number(Number(result.weight).toFixed(3));
                results.tags[tId] = result;
                results.n++;
                // log.debug(result);
              }
            })
            .catch(function (err) {
              log.error(err);
            })
        );
      }
    }

    Promise.all(actions).then(function () {

      evaluator.record('after calculate');
      evaluator.print(results.n, true, true);

      if (results.n == 0) return;
      console.log(results.n);


      // save results in redis
      RedisClient.insertResults(results)
        .then(function () {
          log.trace('Redis insert success');
        })
        .catch(function (err) {
          throw err;
        });

      results.task = '0';
      // save results in mongodb
      mongoClient.insertResults(results)
        .then(function (res) {
          log.trace('Mongo insert success');
        })
        .catch(function (err) {
          throw err;
        });

      // var answer = JSON.parse(JSON.stringify(results));
      // console.log('\nAnswer: ' + JSON.stringify(results));
      // // return results to map
      // for (let user_id in connectionsForMap) {
      //   if (typeof (connectionsForMap[user_id].floorInfo) === "undefined") continue;
      //   console.log('\nReturn Message to ' + user_id + '(map) at ' + Date.now() + ':');
      //   for (let tId in answe r.tags) {
      //     var coord = coordConverter.convert(
      //       answer.tags[tId].pos,
      //       connectionsForMap[user_id].floorInfo,
      //       { "length_x": "44", "length_y": "55" }
      //     ); // TO BE DONE
      //     answer.tags[tId].pos = coord;
      //   }
      //   connectionsForMap[user_id].sendUTF(JSON.stringify(answer));
      // }
    });

  });
};

const cyclicDelete = (deleteTimeInterval) => {

  let time = Date.now() / 1000;
  let timeRange = [0, time - deleteTimeInterval / 1000];

  return RedisClient.zremrangebyscore(redisKey, ...timeRange, function (err, response) {
    if (err) {
      log.error(err);
    }
    log.diag('delete ' + response + ' items');
  });
};

setInterval(function () {
  cyclicLoad(loadTimeInterval);
}, loadTimeInterval);

setInterval(function () {
  cyclicDelete(deleteTimeInterval);
}, deleteTimeInterval);

function locateForTag(tId, input) {
  return new Promise(function (resolve, reject) {
    RedisClient.getPrevious(tId)
      .then(function (previous) {
        input.previous = previous;
        log.debug('Locating for tag ' + tId + ' using parameters: ');
        log.debug(JSON.stringify(input));
        var result = {};
        if (locationManager.locate(input, result)) {
          resolve(result);
        } else {
          reject(result);
        }
      })
      .catch(function (err) {
        reject(err);
      });
  });
}