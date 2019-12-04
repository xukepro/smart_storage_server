var math = require('mathjs');
var rcoords = require('../data/coordinate').getRcoords;

const FactorA = -69.34;
const FactorN = 1.221;

const deploymentHeight = 0; // 不考虑部署高度
const TRItimeout = 10;//s

const DOPWeight = 2;

/*---------------- 最大似然求解位置 -----------------/
Sample:
input = {
  data: [
    ["XXXXX", -XX],
    [...],
    ...
  ],
  previous: {
    pos: [XX.X, XX.X],
    weight: -XX.X,
    DOP: XX.X
  },
  timestamp: XXXXXXXXX
}
/-------------------------------------------------*/
module.exports.locate = locate;
function locate(input, result) {

  // 参考点数组（beacon或anchor）
  var refps = [];
  var thisWeight = 0;

  let rUse = 3;
  var source = JSON.parse(JSON.stringify(input.data));

  // 得到refps数组，包含每个未知点参考点的距离，rUse为算法使用参考点个数
  while (source.length > 0) {
    let refdata = source.shift();
    var refpoint = {
      'id': refdata[0],
      'rssi': refdata[1]
    }
    if (refpoint.id in rcoords) { // 填充参考点坐标信息
      refpoint.coord = rcoords[refpoint.id];
    } else {
      continue;
    }
    // 根据rssi计算距离
    let dis = distanceFormRssi(refpoint.rssi, refpoint.coord[2], refpoint.coord[3]);
    // 计算本次权值
    thisWeight += refpoint.rssi / dis;
    // 考虑参考点部署高度
    var realdis = realDistance(dis, deploymentHeight);
    refpoint.distance = realdis;
    refps.push(refpoint);
    // 找到两个有效参考点后结束
    if (refps.length >= rUse - 1) {
      break;
    }
  }

  if (refps.length < 2) {
    return 0;
  }

  console.log('refps at first: ' + JSON.stringify(refps));

  // 寻找第三个参考点，result为返回值
  var bestResult = findBestRefpoint(source, refps);
  // 继续寻找使DOP最小的参考点，弃用
  // if ('needBestDOP' in input) {
  //   if (input.needBestDOP === 1) {
  //     while (bestResult.DOP > 2) {
  //       refps.pop();
  //       let newResult = findBestRefpoint(source, refps);
  //       if ('error' in newResult) {
  //         break;
  //       }
  //       if (newResult.DOP < bestResult.DOP) {
  //         bestResult = newResult;
  //       }
  //     }
  //     // console.log('selected refps: ' + JSON.stringify(refps, null, 2));
  //   }
  // }

  // console.log('reference points used: ' + JSON.stringify(refps));
  // console.log('bestResult: ' + JSON.stringify(bestResult));

  result.weight = thisWeight + bestResult.weight;
  result.pos = bestResult.pos;
  result.DOP = bestResult.DOP;
  result.timestamp = input.timestamp;
  result.type = 'normal';

  if ('previous' in input && input.previous.length >= 2) {
    console.log('previous: ' + JSON.stringify(input.previous));
    var maxInterval = input.timestamp - input.previous[0].timestamp;
    // console.log('maxInterval: ' + maxInterval);
    if (maxInterval <= TRItimeout) {
      let slidingList = input.previous;
      slidingList.push(result);
      // 三角加权质心定位
      result.pos = WTRIlocation(slidingList);
      result.type = 'weighted';
    }
  }

  return 1;
}

function findBestRefpoint(source, refps) {
  var refpoint = findVaildRefpoint(source, refps);
  if ('error' in refpoint) {
    return refpoint;
  }

  // 根据rssi计算距离
  let dis = distanceFormRssi(refpoint.rssi, refpoint.coord[2], refpoint.coord[3]);
  // 计算本次权值
  let weight = refpoint.rssi / dis;
  // 考虑参考点部署高度
  let realdis = realDistance(dis, deploymentHeight);
  refpoint.distance = realdis;
  refps.push(refpoint);

  // 最大似然求解位置
  let position = MLlocation(refps);
  let DOP = DOPcalcultor(refps, position);

  return {
    'weight': weight,
    'pos': position,
    'DOP': DOP
  };
}

function findVaildRefpoint(source, existRefps) {
  while (source.length > 0) {
    let refdata = source.shift();
    var refpoint = {
      'id': refdata[0],
      'rssi': refdata[1]
    }
    if (refpoint.id in rcoords) { // 填充参考点坐标信息
      refpoint.coord = rcoords[refpoint.id];
    } else {
      continue;
    }
    if (checkVaildRefpoint(refpoint, existRefps)) {
      return refpoint;
    }
  }
  return { error: 1 };
}

// 判断某参考点是否与前两个参考点不共线
function checkVaildRefpoint(refpoint, existRefps) {
  if ((refpoint.coord[0] == existRefps[0].coord[0] && refpoint.coord[0] == existRefps[1].coord[0])
    || (refpoint.coord[1] == existRefps[0].coord[1] && refpoint.coord[1] == existRefps[1].coord[1])) {
    return false;
  } else {
    return true;
  }
}

/*---------------- 最大似然求解位置 -----------------/
Sample:
refps = 
[ { id: 10001-19899,
    rssi: -35,
    coord: [ 29.75, 31, -69.34, 1.221 ],
    distance: 0.0015401080381823758 
  }, {...}, ...]
/-------------------------------------------------*/
function MLlocation(refps) {
  console.log('refps: ' + JSON.stringify(refps));
  var aCount = refps.length;

  var left = math.zeros(aCount - 1, 2);
  for (let i = 0; i < left.size()[0]; i++) {
    for (let j = 0; j < left.size()[1]; j++) {
      left.subset(math.index(i, j), 2 * (refps[i].coord[j] - refps[aCount - 1].coord[j]));
    }
  }
  var leftT = math.transpose(left);
  var left2 = math.multiply(leftT, left);
  var left2i = math.inv(left2);
  var left3 = math.multiply(left2i, leftT);
  var right = math.zeros(aCount - 1);
  for (let i = 0; i < right.size()[0]; i++) {
    right.subset(
      math.index(i, 0),
      Math.pow(refps[i].coord[0], 2) - Math.pow(refps[aCount - 1].coord[0], 2) +
      Math.pow(refps[i].coord[1], 2) - Math.pow(refps[aCount - 1].coord[1], 2) +
      Math.pow(refps[aCount - 1].distance, 2) - Math.pow(refps[i].distance, 2)
    );
  }
  var pos = math.multiply(left3, right);
  var posT = math.transpose(pos);

  return posT.toArray()[0];
}

/*---------------- 加权三角质心算法 -----------------/
Sample:
slidingList = 
[ { weight: -39008.80551928108,
    pos: [
      26.47503500451754,
      34.42499963637112
    ],
    DOP: 1.4037437089458702,
    timestamp: 1554861533000,
    type: 'weighted'
  }, {...}, ...]
/-------------------------------------------------*/
function WTRIlocation(slidingList) {
  var weightedPos = [0, 0];
  var sumWxP = [0, 0];
  var sumW = 0;
  for (let i = 0; i < slidingList.length; i++) {
    sumWxP[0] += slidingList[i].weight * slidingList[i].pos[0] / Math.pow(slidingList[i].DOP, DOPWeight);
    sumWxP[1] += slidingList[i].weight * slidingList[i].pos[1] / Math.pow(slidingList[i].DOP, DOPWeight);
    sumW += slidingList[i].weight / Math.pow(slidingList[i].DOP, DOPWeight);
  }
  weightedPos[0] = sumWxP[0] / sumW;
  weightedPos[1] = sumWxP[1] / sumW;

  return weightedPos;
}

function distanceFormRssi(rssi, factorA, factorN) {
  if (factorA == 0) {
    factorA = FactorA;
  }
  if (factorN == 0) {
    factorN = FactorN;
  }
  var power = (factorA - rssi) / (10 * factorN);
  return Math.pow(10, power)
}

function realDistance(distance, height) {
  if (distance > height) {
    return Math.sqrt(Math.pow(distance, 2) - Math.pow(height, 2));
  }
  return distance;
}

/*---------------- 计算几何精度因子 -----------------/
Sample:
visions = refps =
[ { id: 10001-19899,
    rssi: -35,
    coord: [ 29.75, 31, -69.34, 1.221 ],
    distance: 0.0015401080381823758
  }, {...}, ...]
postion = [
  26.47503500451754,
  34.42499963637112
],
/-------------------------------------------------*/
function DOPcalcultor(visions, position) {
  let vcount = visions.length;
  if (vcount < 3) {
    return -1;
  }

  var A = math.zeros(vcount, 3);
  for (let i = 0; i < A.size()[0]; i++) {
    var dx = visions[i].coord[0] - position[0];
    var dy = visions[i].coord[1] - position[1];
    var dis = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
    A.subset(math.index(i, 0), dx / dis);
    A.subset(math.index(i, 1), dy / dis);
    A.subset(math.index(i, 2), 1);
  }
  var AT = math.transpose(A);
  var ATA = math.multiply(AT, A);
  var ATAi = math.inv(ATA);

  var G = ATAi.toArray();
  var GP = G[0][0] + G[1][1] + G[2][2];
  if (GP >= 0) {
    return Math.sqrt(GP);
  } else {
    return 99999999.0;
  }
}