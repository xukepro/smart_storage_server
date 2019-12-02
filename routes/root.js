var utils = require('../lib/utils');
var locationManager = require('../lib/locationManager');
var coordConverter = require('../lib/coordConverter');
var MongoClient = require('../lib/mongoClient');
var RedisClient = require('../lib/redisClient');

module.exports = function init(request, wsConnection) {
  wsConnection.init(request, 'root', 'utf8', function(message) {
    try {
      messageHandler(message);
    } catch (e) {
      console.error(e);
    }
  });
};

function messageHandler(message) {
  let json = JSON.parse(message.utf8Data);
  // json = {
  //   'anchors': {
  //     '904E9140F916': [
  //       '23FDA50693A4E24FB1AFCFC6EB0764782527110001',
  //       '27FDA50693A4E24FB1AFCFC6EB0764782527110002',
  //       '30FDA50693A4E24FB1AFCFC6EB0764782527110003'
  //     ],
  //     '904E9140F917': [
  //       '28FDA50693A4E24FB1AFCFC6EB0764782527110001',
  //       '21FDA50693A4E24FB1AFCFC6EB0764782527110002'
  //     ],
  //     '904E9140F918': [
  //       '2FFDA50693A4E24FB1AFCFC6EB0764782527110001',
  //       '2DFDA50693A4E24FB1AFCFC6EB0764782527110002'
  //     ],
  //   },
  //   'timestamp': Date.now()
  // }
  if (!('anchors' in json) || !('timestamp' in json)) {
    console.log('wrong data from ' + query.user_id + '(root)');
    return;
  }
  var tidied_json = utils.tidyRootJSON(json);
  console.log('tidied_json: ' + JSON.stringify(tidied_json));

  // save request in mongodb
  MongoClient.insertRequest(json)
    .then(function (res) {
      console.log('Mongo insert success');
    })
    .catch(function (err) {
      throw err;
    });

  let results = { 'n': 0, 'tags': {} };
  var actions = [];
  for (let tId in tidied_json.tags) {
    var anchors = tidied_json.tags[tId];
    if (anchors.length >= 3) {
      anchors.sort(utils.keysort('rssi', true));
      var input = { 'data': anchors, 'timestamp': tidied_json.timestamp };
      actions.push(
        locateForTag(tId, input)
          .then(function (result) {
            if ('pos' in result) {
              result.pos = [
                Number(Number(result.pos[0]).toFixed(6)),
                Number(Number(result.pos[1]).toFixed(6))
              ];
              result.DOP = Number(Number(result.DOP).toFixed(6));
              result.weight = Number(Number(result.weight).toFixed(3));
              results.tags[tId] = result;
              results.n++;
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
    // let maps = wsConnections.maps;
    // for (let user_id in maps) {
    //   if (typeof (maps[user_id].floorInfo) === "undefined") continue;
    //   console.log('\nReturn Message to ' + user_id + '(map) at ' + Date.now() + ':');
    //   for (let tId in answer.tags) {
    //     var coord = coordConverter.convert(
    //       answer.tags[tId].pos,
    //       maps[user_id].floorInfo,
    //       { "length_x": "44", "length_y": "55" }
    //     ); // TO BE DONE
    //     answer.tags[tId].pos = coord;
    //   }
    //   maps[user_id].sendUTF(JSON.stringify(answer));
    // }
  });

}

function locateForTag(tId, input) {
  return new Promise(function (resolve, reject) {
    RedisClient.getPrevious(tId)
      .then(function (previous) {
        input.previous = previous;
        console.log('Locating for tag ' + tId + ' using parameters: ');
        // console.log(JSON.stringify(input));
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