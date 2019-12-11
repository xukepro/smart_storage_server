var locationManager = require('./lib/locationManager');

let evaluator;
let RedisClient;
let mongoClient;
let log;
let config;
let rcoords;

module.exports = function cyclicHandler(globalValues) {

  config = globalValues.config.redis.sortedSet;
  evaluator = new evaluator.Evaluator();
  RedisClient = globalValues.RedisClient;
  mongoClient = globalValues.mongoClient;
  log = globalValues.log.getLogger('cycLoad');
  rcoords = globalValues.rcoords;

  setInterval(function () {
    cyclicLoad();
  }, config.loadTimeInterval);

  setInterval(function () {
    cyclicDelete();
  }, config.deleteTimeInterval);
};

function cyclicLoad() {

  evaluator.cyclic();

  let time = Date.now() / 1000;
  let timeRange = [time - config.loadTimeInterval / 1000 - config.offset / 1000, time - config.offset / 1000];

  evaluator.record();
  return RedisClient.zrangebyscore(config.redisKey, ...timeRange, 'WITHSCORES', function (err, response) {
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
    let tidied_json = transform(time, response);
    evaluator.record();

    let {actions, results} = localization(tidied_json);
    Promise.all(actions).then(function () {

      evaluator.record('after calculate');
      evaluator.print(results.n, true);
      evaluator.handleLine(results.n, true);

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
}

function cyclicDelete() {

  let time = Date.now() / 1000;
  let timeRange = [0, time - config.deleteTimeInterval / 1000];

  return RedisClient.zremrangebyscore(config.redisKey, ...timeRange, function (err, response) {
    if (err) {
      log.error(err);
    }
    log.diag('delete ' + response + ' items');
  });
}

function transform(time, response) {

  let i = 0,
    res,
    tidied_json = {
      timestamp: time - config.offset / 1000,
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

  return tidied_json;
}

function localization(tidied_json) {
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
  return {actions, results};
}

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
