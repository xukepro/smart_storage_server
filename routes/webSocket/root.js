var decoder = require('../../lib/utils').decoder;

var redisKey;
var log;
var redisClient;
var wsConnection;
var mongoClient;

module.exports = function init (request, globalValues) {
  redisKey = globalValues.config.redis.sortedSet.key;
  log = globalValues.log.getLogger("/root");
  redisClient = globalValues.redisClient;
  wsConnection = globalValues.wsConnection;
  mongoClient = globalValues.mongoClient;

  wsConnection.init(request, 'root', 'utf8,binary', function (message) {
    try {
      messageHandler(message);
    } catch (e) {
      console.error(e);
    }
  });
};

function messageHandler (message) {

  let json;

  if (message.type === 'binary') {
    log.trace('handling message: ' + message);
    json = decoder.tagBData(message.binaryData);
  } else {
    log.trace('handling message: ' + JSON.stringify(message));
    json = JSON.parse(message.utf8Data);
  }

  /*  json = {
        'aId': '904E9140F916',
        'tags': [
          '23FDA50693A4E24FB1AFCFC6EB0764782527110001',
          '27FDA50693A4E24FB1AFCFC6EB0764782527110002',
          '30FDA50693A4E24FB1AFCFC6EB0764782527110003'
        ],
      'timestamp': Date.now()
    } */

  if (!Object.prototype.hasOwnProperty.call(json, 'aId')
    || !Object.prototype.hasOwnProperty.call(json, 'tags')) {
    log.error('wrong message data');
    return;
  }

  const decode = (json) => {
    let k = json.aId;
    return {
      aId: k,
      tags: json.tags.map((tId) => decoder.tagData(tId)),
      timestamp: json.timestamp / 1000
    };
  };
  let decodeJson = decode(json);

  log.debug('decodeJson: ' + JSON.stringify(decodeJson));

  let redisObj = [decodeJson.timestamp, JSON.stringify({ aId: decodeJson.aId, tags: decodeJson.tags })];

  //add tidied_json to redis sorted set
  redisClient.insertRequest(redisKey, redisObj)
    .then(function (res) {
      log.trace('added ' + res + ' items to Redis');
    })
    .catch(function (err) {
      throw err;
    });

  // save request in mongodb
  // mongoClient.insertRequest(json)
  //   .then(function (res) {
  //     log.trace('MongoDB insert success');
  //   })
  //   .catch(function (err) {
  //     throw err;
  //   });
}