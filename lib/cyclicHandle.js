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
    this.mapConnections = globalValues.wsConnection.maps;
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

    // evaluator.init(); //evaluator init
    // evaluator.record(); //evaluator first record

    return _this.redisClient
      .getNewRequests(
        _this.redisCfg.key,
        _this.redisCfg.loadTimeInterval / 1000,
        _this.lastTopTime
      )
      .then(function (response) {
        /*
        Sample:
        response = [
           {"aId":"904E9140F010","tags":[{"tId":"10001-04096","rssi":-76}]},
           {"aId":"904E9140F011","tags":[{"tId":"10001-04096","rssi":-86}]},
           {"aId":"904E9140F012","tags":[{"tId":"10001-04096","rssi":-80}]}
         ]
         */
        if (response.requests.length === 0) {
          _this.log.trace(`load 0 item, with top time ${response.maxTime}`);
          return Promise.reject();
        }
        _this.lastTopTime = response.maxTime;
        // evaluator.record(); //evaluator second record

        _this.log.debug(`load data: \n, ${response.requests}`);
        /*
        Sample:
        tidied_json = {
          "timestamp":1600396499.319,
          "tags":{
            "10001-04096":[
              ["904E9140F010",-76],
              ["904E9140F012",-80],
              ["904E9140F011",-86]
            ]
          }
        }
        */
        let tidied_json = _this.transform(response.maxTime, response.requests); //重组数据
        return tidied_json;
      })
      .then((tidied_json) => {
        _this.log.debug(`tidied data: ${JSON.stringify(tidied_json)}`);
        // evaluator.record(); //evaluator third record
        let actions = _this.localization(tidied_json);
        return Promise.all(actions);
      })
      .then((res) => {
        let n = 0; //统计解算成功个数
        res.map((row) => {
          if (row) {
            n++;
            // save results in mongodb
            // _this.mongoClient
            //   .insertOneReuslt(row.tId, row.result)
            //   .then(function (res) {
            //     if (res) {
            //       _this.log.trace(`Mongo insert success: ${row.tId}`);
            //     } else {
            //       _this.log.trace(`Mongo insert fail: ${row.tId}`);
            //     }
            //   })
            //   .catch(function (err) {
            //     throw err;
            //   });
            //
            // save results in redis
            _this.redisClient
              .insertOneReuslt(JSON.stringify(row.result), row.tId, _this.windowSize)
              .then(function () {
                _this.log.trace(`Redis insert success: ${row.tId}`);
              })
              .catch(function (err) {
                throw err;
              });

            // if (!_this.enbmapCfg) return Promise.reject();
            // return pos to map
            for (let uid in _this.mapConnections) {
              var connection = _this.mapConnections[uid];
              _this.log.info(`return ${row.tId} message to map, user: ${uid}`);
              let data = {tId: row.tId, pos: row.result.pos, timestamp: row.result.timestamp};
              _this.log.debug(`data: ${JSON.stringify(data)}`);
              connection.sendUTF(JSON.stringify(data));
            }
            // for (let uid in _this.maps) {
            //   if ( row.tId != map.selectedTag) return Promise.reject();
            //
            //   var map = _this.maps[uid];
            //   _this.log.info(`return ${row.tId} message to map: ${uid}`);
            //
            //   if (uid.indexOf('anyplace') != -1
            //   || typeof map.floorInfo != 'undefined') {
            //     var coord = CoordConverter.convert(
            //       row.result.pos,
            //       map.floorInfo,
            //       { length_x: "44", length_y: "55" }
            //     ); // TO BE DONE
            //     map.sendUTF(JSON.stringify(coord));
            //   } else {
            //     map.sendUTF(JSON.stringify(row.result.pos));
            //   }
            // }

          }
        });
        /* 运行完actions中所有promise进入下一步 */
        // evaluator.record("after calculate");
        // evaluator.print(n, true, true);

        _this.log.diag(n, JSON.stringify(res));
      })
      .catch(function (err) {
        if (err) _this.log.error(err);
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
        _this.log.diag(`delete ${res} item`);
      })
      .catch(function (err) {
        throw err;
      });
  }

  /* 将从redis读取的数据转换为解算需要的格式 */
  transform (time, response) {
    let _this = this;
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
                tidied_json.tags[item.tId].splice(j + 1, 0, [ res.aId, item.rssi ]);
                break;
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
    var actions = [];
    for (let tId in tidied_json.tags) {
      var anchors = tidied_json.tags[tId];
      // if (anchors.length >= 3) {
      // anchors.sort(keysort('rssi', true));
      var input = {
        data: anchors,
        timestamp: tidied_json.timestamp
      };
      actions.push(
        _this
          .locateForTag(tId, input)
          .then(function (result) {
            if (!result) return;
            if (Object.prototype.hasOwnProperty.call(result, 'pos')) {
              result.pos = [
                Number(Number(result.pos[0]).toFixed(6)),
                Number(Number(result.pos[1]).toFixed(6))
              ];
              result.DOP = Number(Number(result.DOP).toFixed(6));
              result.weight = Number(Number(result.weight).toFixed(3));
              _this.log.debug(`解算结果: ${JSON.stringify(result)}`);
              return Promise.resolve({ tId, result });
            }
          })
          .catch(function (err) {
            _this.log.error(err);
          })
      );
      // }
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
          _this.log.debug(`Locating for tag ${tId} using parameters: `);
          var result = {};
          try {
            // var flag = _this.locationManager.locate(input, result);
            var flag = _this.locationManager.locateByLM(input, result);
          } catch (error) {
            _this.log.error(error);
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
