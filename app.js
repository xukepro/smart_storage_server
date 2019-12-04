var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var https = require('https');
var locationManager = require('./lib/locationManager');

var keysort = require('./lib/utils/index').keysort;
var config = require('./config');
var wsConnection = require('./lib/wsConnection');
var RedisClient = require('./lib/redisClient');
var MongoClient = require('./lib/mongoClient');
var redisKey = config.redis.sortedSet.key;
var offset = config.redis.sortedSet.offset;
var loadTimeInterval = config.redis.sortedSet.loadTimeInterval;
var deleteTimeInterval = config.redis.sortedSet.deleteTimeInterval;

var httpServers = [];

var http_server = http.createServer(function (request, response) {
  console.log((new Date()) + ' HTTP Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
http_server.listen(config.http_port, function () {
  console.log((new Date()) + ' HTTP Server is listening on port ' + config.http_port);
});
httpServers.push(http_server);

if (('https_port' in config) && ('sec' in config)) {
  let options = { key: config.sec.key, cert: config.sec.crt };
  var https_server = https.createServer(options, function (request, response) {
    console.log((new Date()) + ' HTTPS Received request for ' + request.url);
    response.writeHead(404);
    response.end();
  });
  https_server.listen(config.https_port, function () {
    console.log((new Date()) + ' HTTPS Server is listening on port ' + config.https_port);
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
router.mount('/root', 'echo-protocol', request => require('./routes/root')(request, wsConnection));
router.mount('/map', 'echo-protocol', request => require('./routes/map')(request, wsConnection));

const cyclicLoad = (loadTimeInterval) => {

  let time = Date.now() / 1000;
  let timeRange = [time - loadTimeInterval / 1000 - offset/1000, time - offset/1000];
  console.log(timeRange, "load...");

  return RedisClient.zrangebyscore(redisKey, ...timeRange, 'WITHSCORES', function (err, response) {
    if (err) {
      console.log(err);
      return;
    }
    if (response.length === 0) {
      console.log((new Date).toLocaleString(), ': load 0 item');
      return;
    }
    console.log((new Date).toLocaleString(), 'load data: ', response);

    let i = 0,
      res,
      tidied_json = {
        timestamp: time - offset/1000,
        tags: {}
      };

    while (i < response.length) {
      try {
        res = JSON.parse(response[i]);
      } catch (err) {
        console.log(err);
        return;
      }

      for (let item of res.tags) {

        if (!tidied_json.tags.hasOwnProperty(item.tId)) {
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
        // console.log(i + '---------------:' + JSON.stringify(tidied_json.tags));
      }
      i = i + 2;
    }
    console.log(JSON.stringify(tidied_json, 0, 2));

    let results = { 'n': 0, 'tags': {} };
    var actions = [];
    for (let tId in tidied_json.tags) {
      var anchors = tidied_json.tags[tId];
      if (anchors.length >= 3) {
        // anchors.sort(keysort('rssi', true));
        var input = { 'data': anchors, 'timestamp': tidied_json.timestamp};
        actions.push(
          locateForTag(tId, input)
            .then(function (result) {
              console.log(result);
              if ('pos' in result) {
                result.pos = [
                  Number(Number(result.pos[0]).toFixed(6)),
                  Number(Number(result.pos[1]).toFixed(6))
                ];
                result.DOP = Number(Number(result.DOP).toFixed(6));
                result.weight = Number(Number(result.weight).toFixed(3));
                results.tags[tId] = result;
                results.n++;
                console.log(results);
              }
            })
            .catch(function (err) {
            })
        );
      }
    }

    Promise.all(actions).then(function () {
      if (results.n == 0) return;

      // save results in redis
      RedisClient.insertResults(results)
        .then(function () {
          console.log('Redis insert success');
        })
        .catch(function (err) {
          throw err;
        });

      results.task = '0';
      // save results in mongodb
      MongoClient.insertResults(results)
        .then(function (res) {
          console.log('Mongo insert success');
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
      //   for (let tId in answer.tags) {
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
  // console.log(timeRange, "delete...");

  return RedisClient.zremrangebyscore(redisKey, ...timeRange, function (err, response) {
    if (err) {
      console.log(err);
    }
    console.log((new Date).toLocaleString(), ': delete ' + response + ' items');
  });
};

setInterval(function () {
  cyclicLoad(loadTimeInterval);
}, loadTimeInterval);

setInterval(function () {
  cyclicDelete(deleteTimeInterval);
}, deleteTimeInterval);

function locateForTag(tId, input) {
  console.log(input);
  return new Promise(function (resolve, reject) {
    RedisClient.getPrevious(tId)
      .then(function (previous) {
        input.previous = previous;
        console.log('Locating for tag ' + tId + ' using parameters: ');
        console.log(JSON.stringify(input));
        console.log('----')
        test();
        var result = {};
        if (locationManager.locate(input, result)) {
          // console.log('Trilateration result: ' + JSON.stringify(result));
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

test = () => {
  console.log('test');
}