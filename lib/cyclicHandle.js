var LocationManager = require("../lib/locationManager");
let Evaluator = require("./utils").evaluator;
let evaluator = new Evaluator();

class CyclicHandler {
  constructor (globalValues) {
    this.redisCfg = globalValues.config.redis.sortedSet;
    this.redisClient = globalValues.redisClient;
    this.mongoClient = globalValues.mongoClient;
    this.log = globalValues.log.getLogger("cycLoad");
    this.locationManager = new LocationManager(globalValues);
  }

  start () {
    let _this = this;
    setInterval(function () {
      _this.cyclicLoad();
    }, _this.redisCfg.loadTimeInterval);

    setInterval(function () {
      _this.cyclicDelete();
    }, _this.redisCfg.deleteTimeInterval);
  }

  /*循环从redis读取数据*/
  cyclicLoad () {
    let _this = this;
    let time = Date.now() / 1000;
    let timeRange = [
      time -
        _this.redisCfg.loadTimeInterval / 1000 -
        _this.redisCfg.offset / 1000,
      time - _this.redisCfg.offset / 1000
    ];

    evaluator.init(); //evaluator init

    return _this.redisClient.getRequests(
      _this.redisCfg.key,
      ...timeRange)
      .then(function (response) {
        if (response.length === 0) {
          _this.log.trace("load 0 item");
          return;
        }
        evaluator.record(); //evaluator second record

        _this.log.debug("load data: ", response);
        let tidied_json = _this.transform(time, response); //重组数据
        _this.log.debug(JSON.stringify(tidied_json));
        evaluator.record(); //evaluator third record

        let actions = _this.localization(tidied_json);

        /* 运行完actions中所有promise进入下一步 */
        Promise.all(actions).then(function (res) {
          evaluator.record("after calculate");
          evaluator.print(res.length, true, true);

          let results = {
            n: res.length,
            tags: {}
          };
          res.map((row) => {
            results.tags[row.tId] = row.result;
          });

          _this.log.diag(JSON.stringify(results));

          if (results.n == 0) return;

          // save results in redis
          _this.redisClient.insertResults(results)
            .then(function () {
              _this.log.trace("Redis insert success");
            })
            .catch(function (err) {
              throw err;
            });

          results.task = "0";
          // save results in mongodb
          _this.mongoClient
            .insertResults(results)
            .then(function (res) {
              _this.log.trace("Mongo insert success");
            })
            .catch(function (err) {
              throw err;
            });

          // var answer = JSON.parse(JSON.stringify(results));
          // console.log('\nAnswer: ' + JSON.stringify(results));
          // // return results to map
          // for (let user_id in connectionsForMap) {
          //   if (typeof (connectionsForMap[user_id].floorInfo) === "undefined") continue;
          //   console.log('\nReturn Message to ' + user_id + '(map) at ' + Date.now() + ':');
          //   for (let tId in answer.tags) {
          //     var coord = coordConverter.convert(
          //       answer.tags[tId].pos,
          //       connectionsForMap[user_id].floorInfo,
          //       { "length_x": "44", "length_y": "55" }
          //     ); // TO BE DONE
          //     answer.tags[tId].pos = coord;
          //   }
          //   connectionsForMap[user_id].sendUTF(JSON.stringify(answer));
          // }
        });
      })
      .catch(function (err) {
        throw err;
      });
  }

  /* 循环从redis删除数据 */
  cyclicDelete () {
    let _this = this;

    let time = Date.now() / 1000;
    let timeRange = [0, time - _this.redisCfg.deleteTimeInterval / 1000];

    return _this.redisClient.delRequests(
      _this.redisCfg.key,
      ...timeRange)
      .then(function (res) {
        _this.log.diag("delete " + res + " items");
      })
      .catch(function (err) {
        throw err;
      });
  }

  /* 将从redis读取的数据转换为解算需要的格式 */
  transform (time, response) {
    let _this = this;
    let i = 0,
      res,
      tidied_json = {
        timestamp: time - _this.redisCfg.offset / 1000,
        tags: {}
      };

    while (i < response.length) {
      try {
        res = JSON.parse(response[i]);
      } catch (err) {
        _this.log.error(err);
        return;
      }

      for (let item of res.tags) {
        if (!Object.prototype.hasOwnProperty.call(tidied_json.tags, item.tId)) {
          tidied_json.tags[item.tId] = [[res.aId, item.rssi]];
        } else {
          let len = tidied_json.tags[item.tId].length;
          //将新数据加入有序数组
          if (item.rssi > tidied_json.tags[item.tId][0][1]) {
            tidied_json.tags[item.tId].unshift([res.aId, item.rssi]);
          } else if (item.rssi < tidied_json.tags[item.tId][len - 1][1]) {
            tidied_json.tags[item.tId].push([res.aId, item.rssi]);
          } else {
            for (let j = 0; j < len - 1; j++) {
              if (
                item.rssi < tidied_json.tags[item.tId][j][1] &&
                item.rssi > tidied_json.tags[item.tId][j + 1][1]
              ) {
                tidied_json.tags[item.tId].splice(j + 1, 0, [
                  res.aId,
                  item.rssi
                ]);
              }
            }
          }
        }
      }
      i = i + 1;
    }

    return tidied_json;
  }

  /* 解算 */
  localization (tidied_json) {
    let _this = this;
    let results = { n: 0, tags: {} };
    var actions = [];
    for (let tId in tidied_json.tags) {
      var anchors = tidied_json.tags[tId];
      if (anchors.length >= 3) {
        // anchors.sort(keysort('rssi', true));
        var input = { data: anchors, timestamp: tidied_json.timestamp };
        actions.push(
          _this
            .locateForTag(tId, input)
            .then(function (result) {
              if (Object.prototype.hasOwnProperty.call(result, "pos")) {
                result.pos = [
                  Number(Number(result.pos[0]).toFixed(6)),
                  Number(Number(result.pos[1]).toFixed(6))
                ];
                result.DOP = Number(Number(result.DOP).toFixed(6));
                result.weight = Number(Number(result.weight).toFixed(3));
                // results.tags[tId] = result;
                // results.n++;
                return Promise.resolve({ tId, result });
                // log.debug(result);
              }
            })
            .catch(function (err) {
              _this.log.error(err);
            })
        );
      }
    }
    return actions;
  }

  /* 每个tag的解算 */
  locateForTag (tId, input) {
    let _this = this;
    return new Promise(function (resolve, reject) {
      _this.redisClient.getPrevious(tId)
        .then(function (previous) {
          input.previous = previous;
          _this.log.debug("Locating for tag " + tId + " using parameters: ");
          var result = {};
          if (_this.locationManager.locate(input, result)) {
            resolve(result);
          } else {
            reject(result);
          }
        })
        .catch(function (err) {
          reject(err);
        });
    });
  }
}

module.exports = CyclicHandler;
