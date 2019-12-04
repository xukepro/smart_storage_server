var utils = require('../lib/utils');
var locationManager = require('../lib/locationManager');
var coordConverter = require('../lib/coordConverter');
var MongoClient = require('../lib/mongoClient');
var RedisClient = require('../lib/redisClient');
var config = require('../config/development');
var redisKey = config.redis.sortedSet.key;
var decoder = require('../lib/utils/decoder');

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
/*   json = {
    'anchors': {
      '904E9140F916': [
        '23FDA50693A4E24FB1AFCFC6EB0764782527110001',
        '27FDA50693A4E24FB1AFCFC6EB0764782527110002',
        '30FDA50693A4E24FB1AFCFC6EB0764782527110003'
      ],
      '904E9140F917': [
        '28FDA50693A4E24FB1AFCFC6EB0764782527110001',
        '21FDA50693A4E24FB1AFCFC6EB0764782527110002'
      ],
      '904E9140F918': [
        '2FFDA50693A4E24FB1AFCFC6EB0764782527110001',
        '2DFDA50693A4E24FB1AFCFC6EB0764782527110002'
      ],
    },
    'timestamp': Date.now()
  } */
  if (!('anchors' in json) || !('timestamp' in json)) {
    console.log('wrong data from ' + query.user_id + '(root)');
    return;
  }
  // var tidied_json = utils.tidyRootJSON(json);
  // console.log('tidied_json: ' + JSON.stringify(tidied_json));

  const decode = (json) => {
    for (let k in json.anchors) {
      return {
        aId: k,
        tags: json.anchors[k].map((tId) => decoder.tagData(tId)),
        timestamp: json.timestamp
      }
    }
  }
  decodeJson = decode(json);
  // console.log(decodeJson);

  redisObj = [decodeJson.timestamp, JSON.stringify({ aId: decodeJson.aId, tags: decodeJson.tags })];
  // console.log(redisObj);

  //add tidied_json to redis sorted set
  RedisClient.zadd(redisKey, redisObj, function (err, response) {
    if (err) {
      console.log(err);
      return;
    };
    console.log('added ' + response + ' items to redis');
  });

  // save request in mongodb
  MongoClient.insertRequest(json)
    .then(function (res) {
      console.log('Mongo insert success');
    })
    .catch(function (err) {
      throw err;
    });
}