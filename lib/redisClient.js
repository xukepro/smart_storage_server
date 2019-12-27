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
    return this.redis.zadd(key, request);
  }

  getNewestRequest (key) {
    return this.redis.zrevrange(key, 0, 0, 'WITHSCORES');
  }

  getRequests (key, minTime, maxTime) {
    return this.redis.zrangebyscore(key, minTime, maxTime);
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
    return this.redis.zremrangebyscore(key, minTime, maxTime);
  }

  insertResults (res, windowSize) {
    var actions = [];
    for (let item in res) {
      let promise = this.insertData(JSON.stringify(item.result), item.tId, windowSize);
      actions.push(promise);
    }
    return Promise.all(actions);
  }

  insertData (strData, tId, windowSize) {
    var task = [];
    if (windowSize === 0) {
      return Promise.resolve();
    }
    for (let i = windowSize - 2; i > -1; i--) {
      task.push(['rename', `${tId}:${i}`, `${tId}:${i+1}`]);
      task.push(['expire', `${tId}:${i+1}`, expire_time]);
    }
    task.push(['setex', `${tId}:0`, expire_time, strData]);
    return this.redis.pipeline(task).exec();
  }

  getOnePrevious (tId, index) {
    return this.get(`${tId}:${index}`);
  }

  getPrevious (tId, windowSize) {
    let _this = this;
    return new Promise(function (resolve, reject) {
      _this.pipPrevious(tId, windowSize)
        .then(function (res) {
          var result = [];
          for (let i = 0; i < windowSize; i++) {
            if (res[i][1] != null) {
              result.push(res[i][1]);
            }
          }
          resolve(result);
        });
    });
  }

  pipPrevious (tId, windowSize) {
    var task = [];
    if (windowSize === 0) {
      return Promise.resolve([]);
    }
    for (let i = windowSize - 1; i > -1; i--) {
      task.push(['get', `${tId}:${i}`]);
    }
    return this.redis.pipeline(task).exec();
  }

}

module.exports = RedisClient;