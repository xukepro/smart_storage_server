var LocationManager = require("../lib/locationManager");
var CoordConverter = require("../lib/coordConverter");
let Evaluator = require("./utils").evaluator;
let evaluator = new Evaluator();

class CyclicHandler {
  constructor (globalValues) {
    this.redisCfg = globalValues.config.redis.sortedSet;
    this.enbmapCfg = globalValues.config.enable_map;
    this.redisClient = globalValues.redisClient;
    this.mongoClient = globalValues.mongoClient;
    this.log = globalValues.log.getLogger("cycLoad");
    this.locationManager = new LocationManager(globalValues);
    this.maps = globalValues.wsConnection.maps;
    this.cNumbers = globalValues.wsConnection.numbers;
    this.windowSize = globalValues.config.solve.windowSize;
  }

  start () {
    let _this = this;
    _this.lastTopTime = 0;
    setInterval(function () {
      if (_this.cNumbers.root !== 0) {
        _this.cyclicLoad();
      }
    }, _this.redisCfg.loadTimeInterval);

    setInterval(function () {
      _this.cyclicDelete();
    }, _this.redisCfg.deleteTimeInterval);
  }

  /*循环从redis读取数据*/
  cyclicLoad () {
    let _this = this;

    evaluator.init(); //evaluator init
    evaluator.record(); //evaluator first record

    return _this.redisClient
      .getNewRequests(
        _this.redisCfg.key,
        _this.redisCfg.loadTimeInterval / 1000,
        _this.lastTopTime
      )
      .then(function (response) {
        if (response.requests.length === 0) {
          _this.log.trace("load 0 item, with top time "+ response.maxTime);
          return Promise.reject();
        }
        _this.lastTopTime = response.maxTime;
        evaluator.record(); //evaluator second record

        _this.log.debug("load data: ", response.requests);
        let tidied_json = _this.transform(response.maxTime, response.requests); //重组数据
        return tidied_json;
      })
      .then((tidied_json) => {
        _this.log.debug(JSON.stringify(tidied_json));
        evaluator.record(); //evaluator third record
        let actions = _this.localization(tidied_json);
        return Promise.all(actions);
      })
      .then((res) => {
        /* 运行完actions中所有promise进入下一步 */
        evaluator.record("after calculate");
        evaluator.print(res.length, true, true);

        let results = {
          n: res.length,
          tags: {}
        };
        res.map((row) => {
          if (row) {
            results.tags[row.tId] = row.result;
          }
        });

        _this.log.diag(JSON.stringify(results));
        return results;
      })
      .then((results) => {
        if (results.n == 0) return Promise.reject();

        // save results in redis
        _this.redisClient
          .insertResults(results, _this.windowSize)
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
          .then(function () {
            _this.log.trace("Mongo insert success");
          })
          .catch(function (err) {
            throw err;
          });

        if (!_this.enbmapCfg) return Promise.reject();

        // return results to map
        for (let uid in _this.maps) {
          var map = _this.maps[uid];
          if (
            !Object.prototype.hasOwnProperty.call(results.tags, map.selectedTag)
          )
            return Promise.reject();
          _this.log.info(
            "return " + map.selectedTag + " message to map: " + uid
          );
          var tag = results.tags[map.selectedTag];
          if (
            uid.indexOf("anyplace") != -1 ||
            typeof map.floorInfo != "undefined"
          ) {
            var coord = CoordConverter.convert(tag.pos, map.floorInfo, {
              length_x: "44",
              length_y: "55"
            }); // TO BE DONE
            map.sendUTF(JSON.stringify(coord));
          } else {
            map.sendUTF(JSON.stringify(tag.pos));
          }
        }
      })
      .catch(function (err) {
        if (err) console.log(err);
      });
  }

  /* 循环从redis删除数据 */
  cyclicDelete () {
    let _this = this;

    let time = Date.now() / 1000;
    let timeRange = [0, time - _this.redisCfg.deleteTimeInterval / 1000];

    return _this.redisClient
      .delRequests(_this.redisCfg.key, ...timeRange)
      .then(function (res) {
        _this.log.diag("delete " + res + " item");
      })
      .catch(function (err) {
        throw err;
      });
  }

  /* 将从redis读取的数据转换为解算需要的格式 */
  transform (time, response) {
    let _this = this;
    let i = 0;
    let res;
    let tidied_json = {
      timestamp: time - _this.redisCfg.offset / 1000,
      tags: {}
    };
    let aIdArr = [];

    for (let i = 0; i < response.length; i++) {
      try {
        res = JSON.parse(response[i]);
      } catch (err) {
        _this.log.error(err);
        return;
      }
      /* 去除相同的tId */
      if (aIdArr.indexOf(res.aId) === -1) {
        aIdArr.push(res.aId);
      } else {
        continue;
      }

      for (let item of res.tags) {
        if (!Object.prototype.hasOwnProperty.call(tidied_json.tags, item.tId)) {
          tidied_json.tags[item.tId] = [[res.aId, item.rssi]];
        } else {
          let len = tidied_json.tags[item.tId].length;
          //将新数据加入有序数组
          if (item.rssi > tidied_json.tags[item.tId][0][1]) {
            tidied_json.tags[item.tId].unshift([res.aId, item.rssi]);
          } else if (item.rssi <= tidied_json.tags[item.tId][len - 1][1]) {
            tidied_json.tags[item.tId].push([res.aId, item.rssi]);
          } else {
            for (let j = 0; j < len - 1; j++) {
              if (
                item.rssi <= tidied_json.tags[item.tId][j][1] &&
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
    }

    return tidied_json;
  }

  /* 解算 */
  localization (tidied_json) {
    let _this = this;
    let results = {
      n: 0,
      tags: {}
    };
    var actions = [];
    for (let tId in tidied_json.tags) {
      var anchors = tidied_json.tags[tId];
      if (anchors.length >= 3) {
        // anchors.sort(keysort('rssi', true));
        var input = {
          data: anchors,
          timestamp: tidied_json.timestamp
        };
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
                return Promise.resolve({
                  tId,
                  result
                });
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
      _this.redisClient
        .getPrevious(tId, _this.windowSize)
        .then(function (previous) {
          input.previous = previous;
          _this.log.debug("Locating for tag " + tId + " using parameters: ");
          var result = {};
          try {
            var flag = _this.locationManager.locate(input, result);
          } catch (error) {
            resolve();
            return;
          }
          if (flag) {
            resolve(result);
          } else {
            resolve();
          }
        })
        .catch(function (err) {
          reject(err);
        });
    });
  }
}

module.exports = CyclicHandler;
