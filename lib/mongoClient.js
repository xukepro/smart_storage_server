let mongoose = require('mongoose');

mongoose.set('useFindAndModify', false);
mongoose.set('useNewUrlParser', true);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

class Schema{
  constructor () {
    this.request = mongoose.Schema({
      aId: String,
      tags: Array,
      timestamp: String
    });
    this.request.index({timestamp: -1});

    this.results = mongoose.Schema({
      weight: Number,
      pos: Array,
      DOP: Number,
      timestamp: Number,
      refps: Array,
      type: String
    });
    this.results.index({timestamp: -1});

    this.coords = mongoose.Schema({
      _id: String,
      coords: Array
    });
    this.tIds = mongoose.Schema({
      _id: String,
    });
  }
}

class MongoClient {
  constructor (config, log) {
    this.config = config;
    this.url = `mongodb://${this.config.host}:${this.config.port}/${this.config.database.dbName}`;
    this.urlResult = `mongodb://${this.config.host}:${this.config.port}/${this.config.database_result.dbName}`;
    this.log = log.getLogger('mongoClient');
    this.mongoose = mongoose;
    // this.mongoose.connect(this.url, { useNewUrlParser: true, useUnifiedTopology: true });

    this.db = this.mongoose.createConnection(this.url);
    this.dbResult = this.mongoose.createConnection(this.urlResult);
    this.db.on('error', function (error) {
      this.log.info(error);
    });
    this.db.once('open', () => {
      this.log.info(`MongoDB connect database: ${this.url}`);
    });
    this.dbResult.on('error', function (error) {
      this.log.info(error);
    });
    this.dbResult.once('open', () => {
      this.log.info(`MongoDB connect database: ${this.urlResult}`);
    });

    this.schema = new Schema();

    this.Request = this.db.model('request', this.schema.request, config.database.request_collection);
    this.TIds = this.db.model('tIds', this.schema.tIds, config.database.tIds_collection);
    this.Coords = this.db.model('coords', this.schema.coords, config.database.coords_collection);

    this.Result_tIds = {};
    this.TIds.find().then((res) => {
      res.map((value) => {
        this.log.info(`MongoDB connect Collection: ${value._id}`);
        this.Result_tIds[value._id] = this.dbResult.model(value._id, this.schema.results, value._id);
      });
    });
  }
  addAIdConnection (tId) {//连接失败验证待完善
    this.log.info(`MongoDB connect Collection: ${tId}`);
    this.Result_tIds[tId] = this.dbResult.model(tId, this.schema.tIds, tId);
  }
  insertRequest (request) {
    return new this.Request(request).save();
  }
  insertResults (tId, result) {
    console.log(result);
    if (!Object.prototype.hasOwnProperty.call(this.Result_tIds, tId)) {
      this.log.info(`${tId} is not supported`);
      return Promise.resolve();
    }
    return new this.Result_tIds[tId](result).save();
  }
  getCoords (query) {
    return this.Coords.find(query);
  }
  upsertCoords (id, coords) {
    return this.Coords.findByIdAndUpdate(id, { 'coords': coords }, { 'upsert': true });
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
