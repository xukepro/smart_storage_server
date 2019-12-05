var MongoClient = require('../lib/mongoClient');
var RedisClient = require('../lib/redisClient');
var config = require('../config/development');
var redisKey = config.redis.sortedSet.key;
var decoder = require('../lib/utils/decoder');

var log = require('log4js').getLogger('/root');

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
  log.debug('handling message: ' + JSON.stringify(message));
  let json = JSON.parse(message.utf8Data);
  //  json = {
  //     'aId': '904E9140F916',
  //     'tags': [
  //       '23FDA50693A4E24FB1AFCFC6EB0764782527110001',
  //       '27FDA50693A4E24FB1AFCFC6EB0764782527110002',
  //       '30FDA50693A4E24FB1AFCFC6EB0764782527110003'
  //     ],
  //   'timestamp': Date.now()
  // }

  if (!json.hasOwnProperty('aId') || !json.hasOwnProperty('tags')) {
    log.error('wrong message data');
    return;
  }

  const decode = (json) => {
    let k = json.aId;
    return {
      aId: k,
      tags: json.tags.map((tId) => decoder.tagData(tId)),
      timestamp: json.timestamp/1000
    }
  }
  let decodeJson = decode(json);
  log.debug('decodeJson: ' + JSON.stringify(decodeJson));

  let redisObj = [decodeJson.timestamp, JSON.stringify({ aId: decodeJson.aId, tags: decodeJson.tags })];

  //add tidied_json to redis sorted set
  RedisClient.zadd(redisKey, redisObj, function (err, res) {
    if (err) {
      log.error(err);
      return;
    }
    log.trace('added ' + res + ' items to redis');
  });

  // save request in mongodb
  MongoClient.insertRequest(json)
    .then(function (res) {
      log.trace('Mongo insert success');
    })
    .catch(function (err) {
      throw err;
    });
}