var Redis = require('ioredis');

const expire_time = 30; // s

class RedisClient {
  constructor (config, log) {
    var _this = this;
    this.log = log.getLogger('redisClient');
    this.redis = new Redis({
      port: config.port,  // Redis port
      host: config.host   // Redis host
    });
    this.redis.once('connect', function (err) {
      _this.log.info("Redis connect success");
      _this.redis.client('setname', `${process.pid}.db`);
    });
  }

  insertRequest (key, request) {
    let _redis = this.redis;
    return _redis.zadd(key, request);
  }

  getNewestRequest (key) {
    let _redis = this.redis;
    return _redis.zrevrange(key, 0, 0, 'WITHSCORES');
  }

  getRequests (key, minTime, maxTime) {
    let _redis = this.redis;
    return _redis.zrangebyscore(key, minTime, maxTime);
  }

  getNewRequests (key, interval, last) {
    let _this = this;
    return new Promise(function (resolve, reject) {
      var maxTime = 0;
      _this.getNewestRequest(key)
        .then(function (res) {
          if (res.length < 2 || (maxTime = Number(res[1])) === last) {
            return [];
          } else {
            return _this.getRequests(key, maxTime - interval, maxTime
            );
          }
        }).then(function (res) {
          resolve({ 'maxTime': maxTime, 'requests': res });
        });
    });
  }

  delRequests (key, minTime, maxTime) {
    let _redis = this.redis;
    return _redis.zremrangebyscore(key, minTime, maxTime);
  }

  insertResults (results) {
    let _this = this;
    var actions = [];
    for (let tId in results.tags) {
      let promise = _this.insertData(JSON.stringify(results.tags[tId]), tId);
      actions.push(promise);
    }
    return Promise.all(actions);
  }

  insertData (strData, tId) {
    let _redis = this.redis;
    let promise = _redis.pipeline()
      .rename(tId + ':1', tId + ':0')
      .expire(tId + ':0', expire_time)
      .setex(tId + ':1', expire_time, strData)
      .exec();
    return promise;
  }

  getOnePrevious (tId, index) {
    let _redis = this.redis;
    return _redis.get(tId + ':' + index);
  }

  getPrevious (tId) {
    let _this = this;
    return new Promise(function (resolve, reject) {
      _this.pipPrevious(tId)
        .then(function (res) {
          if (res[0][1] === null || res[1][1] === null) {
            resolve([]);
          } else {
            resolve([
              JSON.parse(res[0][1]),
              JSON.parse(res[1][1])
            ]);
          }
        });
    });
  }

  pipPrevious (tId) {
    var _redis = this.redis;
    let promise = _redis.pipeline()
      .get(tId + ':0')
      .get(tId + ':1')
      .exec();
    return promise;
  }

}

module.exports = RedisClient;