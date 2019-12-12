let mongoose = require('mongoose');

class Schema{
  constructor () {
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
  constructor (config, log) {
    this.config = config;
    this.url = `mongodb://${this.config.host}:${this.config.port}/${this.config.database}`;
    this.log = log.getLogger('mongoClient');
    console.log(this.url);
    this.mongoose = mongoose;
    this.mongoose.connect(this.url, { useNewUrlParser: true, useUnifiedTopology: true });

    this.db = this.mongoose.connection;
    this.db.on('error', function (error) {
      this.log.info(error);
    });
    this.db.once('open', () => {
      this.log.info("MongoDB connect success");
    });

    this.schema = new Schema();

    this.Request = this.mongoose.model('request', this.schema.request, config.request_collection);
    this.Results = this.mongoose.model('results', this.schema.results, config.results_collection);
    this.Coords = this.mongoose.model('coords', this.schema.coords, config.coords_collection);
  }

  insertRequest (request) {
    return new this.Request(request).save();
  }
  insertResults (results) {
    return new this.Results(results).save();
  }
  getCoords (query) {
    return this.Coords.find(query);
  }
}

module.exports = MongoClient;

// let mongoClient = new MongoClient();
// let getRcoords = require('../data/coordinate');
// for (let k of Object.keys(getRcoords.getRcoords)){
//   let json = {_id: k, coords: getRcoords.getRcoords[k]};
//   console.log(json);
//   mongoClient.Coords(json).save();
// }

// let mongoClient = new MongoClient();
// mongoClient.Coords.watch().on('change', change => {
//   console.log(change);
// });
