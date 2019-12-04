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
    'data': {
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

  if (!json.hasOwnProperty('data') || !json.hasOwnProperty('timestamp')) {
    console.log('wrong data');
    return;
  }
  // var tidied_json = utils.tidyRootJSON(json);
  // console.log('tidied_json: ' + JSON.stringify(tidied_json));

  const decode = (json) => {
    let k = Object.keys(json.data)[0];
    return {
      aId: k,
      tags: json.data[k].map((tId) => decoder.tagData(tId)),
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