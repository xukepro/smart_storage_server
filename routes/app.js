var validator = require('validator');

var stepManager = require('../lib/stepManager');
var locationManager = require('../lib/locationManager');
var Kalman = require('./lib/kalmanFilter');

var log = require('log4js').getLogger('/app');

module.exports = function init(request, wsConnection) {
  wsConnection.init(request, 'app', 'utf8', function (message) {
    try {
      messageHandler(message, request.resourceURL.query.user_id);
    } catch (e) {
      console.error(e);
    }
  });
};

let SKIP = 0;
let TOTAL_COUNT = 10;
var nearestForApp = {};
var kalmanFilterForApp = {}; // kalmanFilter for different users
var totalDistanceForApp = {};

function messageHandler(message, uId) {
  let input = JSON.parse(message.utf8Data);

  var result = {};

  if ('step' in input) { // pdr info, carry out fusion or PDR algorithm
    result = stepForUser(uId, input);
  } else if ('data' in input) {
    result = locateForUser(uId, input);
  }

  // record total distance
  if (result.type === 'fusion' || result.type === 'cupt' || result.type === 'pdr') {
    var totalDis = userTotalDis(uId);
    if (totalDis.previous.length == 0) {
      totalDis.previous = result.pos;
    } else if (totalDis.skiped >= SKIP) {
      totalDis.skiped = 0;
      totalDis.dis += Math.sqrt(Math.pow(result.pos[0] - totalDis.previous[0], 2) + Math.pow(result.pos[1] - totalDis.previous[1], 2));
      totalDis.n += SKIP + 1;
      totalDis.previous = result.pos;
    } else {
      totalDis.skiped++;
    }
  }
}

function stepForUser(uId, input) {
  RedisClient.getPrevious(uId)
  .then(function (previous) {
    if (previous.length <= 0) {
      return {};
    }
    input.previous = previous;

    var totalDis = userTotalDis(uId);
    let verticalPulse = input.step[0] / 0.8;
    if (totalDis.n >= TOTAL_COUNT) { // update k for step length
      totalDis.k = totalDis.dis / (totalDis.n * verticalPulse);
      totalDis.dis = 0;
      totalDis.n = 0;
    }
    input.step = [verticalPulse, input.step[1], totalDis.k];

    let loss = input.previous[input.previous.length - 1].iBeaconLoss;
    var result = {};
    if (loss > 2) {
      initUserKF(uId);
      log.debug('PDR update for user ' + uId + ' using parameters: ');
      log.debug(JSON.stringify(input));
      if (!stepManager.PDR(input, result)) {
        return {};
      }
    } else {
      log.debug('Fusion update for user ' + uId + ' using parameters: ');
      log.debug(JSON.stringify(input));
      if (!stepManager.fusion(userKF(uId), input, result)) {
        return {};
      }
    }
    return result;
  })
  .catch(function (err) {
    return {};
  });
}

let SIZE_CUPT = 2;
let RSSI_CUPT = -54;
// check if all rssi is bellow a certain value and is from a same reference point
module.exports.checkAllRssi = function (refps) {
  if (refps.length < SIZE_CUPT) {
    return 0;
  }
  var id = refps[0][0]
  for (let i = 0; i < refps.length; i++) {
    if (refps[i][0] != id || refps[i][1] < RSSI_CUPT) {
      return 0;
    }
  }
  return 1;
}

function locateForUser(uId, input) {
  RedisClient.getPrevious(uId)
  .then(function (previous) {
    input.previous = previous;
    log.debug('Locating for user ' + uId + ' using parameters: ');
    log.debug(JSON.stringify(input));
    var result = {};
    if (!locationManager.locate(input, result)) {
      return {};
    }
    
    // save the nearest beacon info
    var nearest = userNearest(uId);
    if (nearest.length >= SIZE_CUPT) {
      nearest.shift()
    }
    nearest.push(input.data[0]);
    
    if (checkAllRssi(nearest)) {
      return result;
    }
    // Coordinate UPdaTe algorithm
    stepManager.CUPT(userKF(uId), nearest[0], result);

    return result;
  })
  .catch(function (err) {
    return {};
  });
}

function userKF(uId) {
  if (!kalmanFilterForApp[uId]) {
    initUserKF(uId);
  }
  return kalmanFilterForApp[uId];
}

function initUserKF(uId) {
  kalmanFilterForApp[uId] = new Kalman(
    A = [[1, 0], [0, 1]],
    H = [[1, 0], [0, 1]],
    G = [[1, 0], [0, 1]]
  );
}

function userTotalDis(uId) {
  if (!totalDistanceForApp[uId]) {
    initUserTotalDis(uId);
  }
  return totalDistanceForApp[uId];
}

function initUserTotalDis(uId) {
  totalDistanceForApp[uId] = { previous: [], skiped: 0, dis: 0, n: 0, k: 0.8 };
}

function userNearest(uId) {
  if (!nearestForApp[uId]) {
    initUserNearest(uId);
  }
  return nearestForApp[uId];
}

function initUserNearest(uId) {
  nearestForApp[uId] = [];
}