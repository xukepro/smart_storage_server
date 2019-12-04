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
  console.log(message);
  let json = JSON.parse(message.utf8Data);
/*   json = {
      'aId': '904E9140F916':
      'tags': [
        '23FDA50693A4E24FB1AFCFC6EB0764782527110001',
        '27FDA50693A4E24FB1AFCFC6EB0764782527110002',
        '30FDA50693A4E24FB1AFCFC6EB0764782527110003'
      ],
    'timestamp': Date.now()
  } */

  if (!json.hasOwnProperty('aId') || !json.hasOwnProperty('tags')) {
    console.log('wrong data');
    return;
  }
  // var tidied_json = utils.tidyRootJSON(json);
  // console.log('tidied_json: ' + JSON.stringify(tidied_json));

  const decode = (json) => {
    let k = json.aId;
    return {
      aId: k,
      tags: json.tags.map((tId) => decoder.tagData(tId)),
      timestamp: json.timestamp/1000
    }
  }
  let decodeJson = decode(json);
  console.log(decodeJson);

  let redisObj = [decodeJson.timestamp, JSON.stringify({ aId: decodeJson.aId, tags: decodeJson.tags })];

  //add tidied_json to redis sorted set
  RedisClient.zadd(redisKey, redisObj, function (err, response) {
    if (err) {
      console.log(err);
      return;
    }
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