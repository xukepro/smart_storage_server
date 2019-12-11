var Redis = require('ioredis');
var log = require('log4js').getLogger('redisClient');

const expire_time = 30; // s

class RedisClient {
  constructor(config) {
    var _this = this;
    this.redis = new Redis({
      port: config.port,  // Redis port
      host: config.host   // Redis host
    });
    this.redis.once('connect', function (err) {
      _this.redis.client('setname', `${process.pid}.db`);
    });
  }

  insertReqest(key, Reqest) {
    let _redis = this.redis;
    return _redis.zadd(key, Reqest);
  }

  getReqests(key, minTime, maxTime, withscores) {
    let _redis = this.redis;
    return _redis.zrangebyscore(key, minTime, maxTime, withscores);
  }

  delReqests(key, minTime, maxTime) {
    let _redis = this.redis;
    return _redis.zremrangebyscore(key, minTime, maxTime);
  }

  insertResults(results) {
    let _this = this;
    var actions = [];
    for (let tId in results.tags) {
      let promise = _this.insertData(JSON.stringify(results.tags[tId]), tId);
      actions.push(promise);
    }
    return Promise.all(actions);
  }

  insertData(strData, tId) {
    let _redis = this.redis;
    let promise = _redis.pipeline()
      .rename(tId + ':1', tId + ':0')
      .expire(tId + ':0', expire_time)
      .setex(tId + ':1', expire_time, strData)
      .exec();
    return promise;
  }

  getOnePrevious(tId, index) {
    let _redis = this.redis;
    return _redis.get(tId + ':' + index);
  }

  getPrevious(tId) {
    let _this = this;
    return new Promise(function (resolve, reject) {
      _this.pipPrevious(tId)
        .then(function (res) {
          resolve([
            JSON.parse(res[0][1]),
            JSON.parse(res[1][1])
          ]);
        });
    });
  }

  pipPrevious(tId) {
    var _redis = this.redis;
    let promise = _redis.pipeline()
      .get(tId + ':0')
      .get(tId + ':1')
      .exec();
    return promise;
  }

}

module.exports = RedisClient;