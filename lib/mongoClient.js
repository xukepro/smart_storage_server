let mongoose = require('mongoose');
let { formateDate } = require('./utils');

mongoose.set('useFindAndModify', false);
mongoose.set('useNewUrlParser', true);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);

class Schema{
  constructor () {
    /* 请求数据 */
    this.request = mongoose.Schema({
      aId: String,
      tags: Array,
      timestamp: String
    });
    this.request.index({timestamp: -1});

    /* 解算结果 */
    this.results = mongoose.Schema({
      weight: Number,
      pos: Array,
      DOP: Number,
      timestamp: Number,
      refps: Array,
      type: String
    });
    this.results.index({timestamp: -1});

    /* 锚点数据 */
    this.anchors = mongoose.Schema({
      aId: { type: String, unique: true },
      coords: Array,
      createTime: {
        type: Date,
        // default: Date.now,
        get: val => formateDate(val)
      },
      updateTime: {
        type: Date,
        // default: Date.now,
        get: val => formateDate(val)
      }
    }, {
      versionKey: false,
      timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
    });
    this.anchors.set('toJSON', { getters: true }) //设置打印虚拟值

    /* 标签数据 */
    this.tags = mongoose.Schema({
      tId: { type: String, unique: true },
      user: { type: mongoose.SchemaTypes.ObjectId, ref: "User" },
      description: String,
      status: String,
      createTime: {
        type: Date,
        // default: Date.now,
        get: val => formateDate(val)
      },
      updateTime: {
        type: Date,
        // default: Date.now,
        get: val => formateDate(val)
      }
    }, {
      versionKey: false,
      timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
    });
    this.tags.set('toJSON', { getters: true }) //设置打印虚拟值

    /* 管理员 */
    this.adminUser = mongoose.Schema({
      username: String,
      password: {
        type: String,
        select: false,
        set (val) {
          return require("bcryptjs").hashSync(val, 10);
        }
      },
    });

    /* 普通用户 */
    this.user = mongoose.Schema({
      username: { type: String, unique: true},
      email: { type: String },
      password: {
        type: String,
        select: false,
        set (val) {
          return require("bcryptjs").hashSync(val, 10);
        }
      },
      tags: [{ type: mongoose.SchemaTypes.ObjectId, ref: "Tags"}],
      lastLoginTime: {
        type: Date,
        // default: Date.now,
        get: val => formateDate(val)
      },
      createTime: {
        type: Date,
        // default: Date.now,
        get: val => formateDate(val)
      },
      updateTime: {
        type: Date,
        // default: Date.now,
        get: val => formateDate(val)
      }
    }, {
      versionKey: false,
      timestamps: { createdAt: 'createTime', updatedAt: 'updateTime' }
    });
    this.user.set('toJSON', { getters: true }) //设置打印虚拟值
  }
}

class MongoClient {
  constructor (config, log, tags, anchors) {
    this.config = config;
    this.log = log.getLogger('mongoClient');
    this.tags = tags;
    this.anchors = anchors;

    this.urlHead = `mongodb://${this.config.host}:${this.config.port}/`;
    this.urlResult = `mongodb://${this.config.host}:${this.config.port}/${this.config.db_result.name}`;

    this.db = this.dbConncet(this.config.db.name);
    this.dbResult = this.dbConncet(this.config.db_result.name);

    this.schema = new Schema();

    this.Request = this.db.model('Request', this.schema.request, config.db.request_collection);
    this.Tags = this.db.model('Tags', this.schema.tags, config.db.tags_collection);
    this.Anchors = this.db.model('Anchors', this.schema.anchors, config.db.anchors_collection);
    this.AdminUser = this.db.model('AdminUser', this.schema.adminUser, config.db.adminUser_collection);
    this.User = this.db.model('User', this.schema.user, config.db.user_collection);
    this.Result_tags = {}; // models of tags in dbResult

    this.loadTags();
    this.loadAnchors();

    this.Tags.watch().on('change', change => {
      this.loadTags();
    });
    this.Anchors.watch().on('change', change => {
      this.loadAnchors();
    });
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
    if (this.tags.indexOf(tId) === -1) {
      return Promise.resolve();
    }
    if (!Object.prototype.hasOwnProperty.call(this.Result_tags, tId)) {
      this.Result_tags[tId] = this.dbResult.model(tId, this.schema.results, tId);
      this.log.info(`MongoDB connect Collection: ${tId}`);
    }
    return new this.Result_tags[tId](res).save();
  }

  loadTags () {
    /* get tags globalValues */
    let _this = this;
    return _this.Tags.find().then(res => {
      _this.tags.splice(0, _this.tags.length);
      for (let vaule of res) {
        _this.tags.push(vaule.tId);
        _this.Result_tags[vaule.tId] = this.dbResult.model(vaule.tId, this.schema.results, vaule.tId);
      }
      return _this.tags;
    });
  }

  upsertTags (tId) {
    return this.Tags.updateOne({tId}, {tId}, { 'upsert': true });
  }

  loadAnchors () {
    /* get rcoods for globalValues */
    let _this = this;
    return _this.Anchors.find().then(res => {
      for (let value of res) {
        _this.anchors[value.aId] = value.coords;
      }
      return _this.anchors;
    });
  }

  upsertAnchors (aId, coords) {
    return this.Anchors.updateOne({aId}, { 'coords': coords }, { 'upsert': true });
  }
}

module.exports = MongoClient;
