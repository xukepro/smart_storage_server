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

    this.tags = mongoose.Schema({
      _id: String
    });
  }
}

class MongoClient {
  constructor (config, log, tags, coords) {
    this.config = config;
    this.log = log.getLogger('mongoClient');
    this.tags = tags;
    this.coords = coords;

    this.urlHead = `mongodb://${this.config.host}:${this.config.port}/`;
    this.urlResult = `mongodb://${this.config.host}:${this.config.port}/${this.config.db_result.name}`;

    this.db = this.dbConncet(this.config.db.name);
    this.dbResult = this.dbConncet(this.config.db_result.name);

    this.schema = new Schema();

    this.Request = this.db.model('request', this.schema.request, config.db.request_collection);
    this.Tags = this.db.model('tags', this.schema.tags, config.db.tags_collection);
    this.Coords = this.db.model('coords', this.schema.coords, config.db.coords_collection);
    this.Result_tags = {}; // models of tags in dbResult

    this.getTags();
    this.getCoords();
  }

  dbConncet (dbName) {
    var db = mongoose.createConnection(this.urlHead + dbName);
    db.on('error', (error) => this.dbOpenFailed(db, error));
    db.once('open', () => this.dbOpend(db));
    return db;
  }

  dbOpend (db) {
    this.log.info(`MongoDB connect: ${db.client.s.url} successed`);
  }

  dbOpenFailed (db, error) {
    this.log.error(`MongoDB connect ${db.client.s.url} failed.\x1b[91m ${error}`);
  }

  insertRequest (request) {
    return new this.Request(request).save();
  }

  insertOneReuslt (tId, res) {
    // check if this tag is in the white list
    if (!Object.prototype.hasOwnProperty.call(this.tags, tId)) {
      return Promise.resolve();
    }
    if (!Object.prototype.hasOwnProperty.call(this.Result_tags, tId)) {
      this.Result_tags[tId] = this.dbResult.model(tId, this.schema.tags, tId);
      this.log.info(`MongoDB connect Collection: ${tId}`);
    }
    return new this.Result_tags[tId](res).save();
  }

  getTags () {
    /* get tags globalValues */
    let _this = this;
    return new Promise(function (resolve, reject) {
      _this.Tags.find()
        .then(res => {
          for (let vaule of res) {
            _this.tags.push(vaule._id);
          }
          resolve(_this.tags);
        })
        .catch(function (err) {
          reject(err);
        });
    });
  }

  upsertTags (tId) {
    return this.Tags.findByIdAndUpdate(tId, { 'upsert': true });
  }

  getCoords () {
    /* get rcoods for globalValues */
    let _this = this;
    return new Promise(function (resolve, reject) {
      _this.Tags.find()
        .then(res => {
          for (let vaule in res) {
            _this.coords[vaule._id] = vaule.coords;
          }
          resolve(_this.coords);
        })
        .catch(function (err) {
          reject(err);
        });
    });
  }

  upsertCoords (id, coords) {
    return this.Coords.findByIdAndUpdate(id, { 'coords': coords }, { 'upsert': true });
  }
}

module.exports = MongoClient;