// var mongoClient = require('mongodb').MongoClient;
var config = require('../config').mongodb;
var mongoose = require('mongoose');
var log = require('log4js').getLogger('redisClient');

const url = `mongodb://${config.host}:${config.port}/${config.database}`;

class Schema{
  constructor() {
    this.request = mongoose.Schema({
      aId: String,
      tags: Array,
      timestamp: String
    });
    this.results = mongoose.Schema({
      n: Number,
      tags: Object
    });
    this.coords = mongoose.Schema({
      _id: String,
      coords: Array
    });
  }
}

class MongoClient {
  constructor() {
    this.mongoose = mongoose;
    this.mongoose.connect(url, { useNewUrlParser: true });

    this.db = this.mongoose.connection;
    this.db.on('error', function (error) {
      log.error(error);
    });
    this.db.once('open', () => {
      log.info("MongoDB connect success");
    });

    this.schema = new Schema();

    this.Request = this.mongoose.model('request', this.schema.request, config.request_collection);
    this.Results = this.mongoose.model('results', this.schema.results, config.results_collection);
    this.Coords = this.mongoose.model('coords', this.schema.coords, config.coords_collection);
  }
  
  insertRequest(request) {
    return new this.Request(request).save();
  }
  insertResults(results) {
    return new this.Results(results).save();
  }
  getCoords(query) {
    return this.Coords.find(query)
  }
}

module.exports = MongoClient;