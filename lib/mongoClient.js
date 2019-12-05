var mongoClient = require('mongodb').MongoClient;
var config = require('../config').mongodb;

var log = require('log4js').getLogger('redisClient');

var url = 'mongodb://' + config.host + ':' + config.port + '/';

module.exports = mongoClient;

mongoClient.insertRequest = insertRequest;
function insertRequest(request) {
  return new Promise(function (resolve, reject) {
    mongoClient.connect(url, { useNewUrlParser: true }, function (c_err, db) {
      if (c_err) reject(c_err);
      var dbo = db.db(config.database);
      dbo.collection(config.request_collection)
        .insertOne(request, function (i_err, res) {
          if (i_err) reject(i_err);
          db.close();
          resolve(res);
        });
    });
  });
}

mongoClient.insertResults = insertResults;
function insertResults(results) {
  return new Promise(function (resolve, reject) {
    mongoClient.connect(url, { useNewUrlParser: true }, function (c_err, db) {
      if (c_err) reject(c_err);
      var dbo = db.db(config.database);
      dbo.collection(config.results_collection)
        .insertOne(results, function (i_err, res) {
          if (i_err) reject(i_err);
          db.close();
          resolve(res);
        });
    });
  });
}