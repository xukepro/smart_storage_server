var math = require('mathjs');
var acoords = require('../data/coordinate').getAcoords;

const FactorA = -69.34;
const FactorN = 1.221;

const heightFormAnchor = 0; // 不考虑部署高度
const TRItimeout = 10000;

const DOPWeight = 2;

/*---------------- 最大似然求解位置 -----------------/
Sample:
input = {
  anchors: [{"aId":"XXXXX-XXXXX","rssi":-XX},{...},...],
  timestamp: XXXXXXXXX
}
/-------------------------------------------------*/
module.exports.locate = locate;
function locate(input, result) {

  var anchors = [];
  var thisweight = 0;

  var aUse = 3;
  var source = JSON.parse(JSON.stringify(input.anchors));

  // 得到anchors数组，包含每个anchor的距离，aUse为算法使用anchor个数
  for (let i = 0; i < source.length; i++) {
    var anchor = source.shift();
    if (anchor.aId in acoords) { // 填充锚点坐标信息
      anchor.coord = acoords[anchor.aId];
    } else {
      continue;
    }
    // 根据rssi计算距离
    var distance = distanceFormRssi(anchor.rssi, anchor.coord[2], anchor.coord[3]);
    // 计算本次权值
    thisweight += anchor.rssi / distance;
    // 考虑anchor部署高度
    var realdis = realDistance(distance, heightFormAnchor);
    anchor.distance = realdis;
    anchors.push(anchor);
    if (anchor >= aUse - 1) {
      break;
    }
  }

  if (anchors.length < 2) {
    return 0;
  }

  // console.log('anchors at first: ' + JSON.stringify(anchors));

  // result为返回值
  var bestResult = findBestAnchors(source, anchors);
  // if ('needBestDOP' in input) {
  //   if (input.needBestDOP === 1) {
  //     while (bestResult.DOP > 2) {
  //       anchors.pop();
  //       let newResult = findBestAnchors(source, anchors);
  //       if ('error' in newResult) {
  //         break;
  //       }
  //       if (newResult.DOP < bestResult.DOP) {
  //         bestResult = newResult;
  //       }
  //     }
  //     // console.log('selected anchors: ' + JSON.stringify(anchors, null, 2));
  //   }
  // }
  
  // console.log('anchors used: ' + JSON.stringify(anchors));
  // console.log('bestResult: ' + JSON.stringify(bestResult));

  result.weight = thisweight + bestResult.weight;
  result.pos = bestResult.pos;
  result.DOP = bestResult.DOP;
  // result.DOP = 1;
  result.timestamp = input.timestamp;
  result.type = 'normal';

  if ('previous' in input && input.previous.length >= 2) {
    var maxInterval = input.timestamp - input.previous[0].timestamp;
    // console.log('maxInterval: ' + maxInterval);
    if (maxInterval <= TRItimeout) {
      let slidingList = input.previous;
      slidingList.push(result);
      result.pos = WTRIlocation(slidingList);
      result.type = 'weighted';
    }
  }

  return 1;
}

function findBestAnchors(source, anchors) {
  var anchor = findVaildAnchor(source, anchors);
  if ('error' in anchor) {
    return anchor;
  }

  // 根据rssi计算距离
  var distance = distanceFormRssi(anchor.rssi, anchor.coord[2], anchor.coord[3]);
  // 计算本次权值
  var weight = anchor.rssi / distance;
  // 考虑anchor部署高度
  var realdis = realDistance(distance, heightFormAnchor);
  anchor.distance = realdis;
  anchors.push(anchor);

  // 最大似然求解位置
  var position = MLlocation(anchors);

  var DOP = DOPcalcultor(anchors, position);
  // var DOP = 1;

  var result = {};
  result.weight = weight;
  result.pos = position;
  result.DOP = DOP;

  return result;
}

function findVaildAnchor(source, existanchors) {
  for (let i = 0; i < source.length; i++) {
    let anchor = source.shift();
    if (anchor.aId in acoords) { // 填充锚点坐标信息
      anchor.coord = acoords[anchor.aId];
    } else {
      continue;
    }
    if (checkVaildAnchor(anchor, existanchors)) {
      return anchor;
    }
  }
  return { error: 1 };
}

function checkVaildAnchor(anchor, existanchors) {
  if ((anchor.coord[0] == existanchors[0].coord[0] && anchor.coord[0] == existanchors[1].coord[0])
    || (anchor.coord[1] == existanchors[0].coord[1] && anchor.coord[1] == existanchors[1].coord[1])) {
    return false;
  } else {
    return true;
  }
}

/*---------------- 最大似然求解位置 -----------------/
Sample:
anchors = 
[ { uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
    major: 10001,
    minor: 19899,
    rssi: -35,
    coord: [ 29.75, 31, -69.34, 1.221 ],
    distance: 0.0015401080381823758 
  }, {...}, ...]
/-------------------------------------------------*/
function MLlocation(anchors) {
  var aCount = anchors.length;

  var left = math.zeros(aCount - 1, 2);
  for (let i = 0; i < left.size()[0]; i++) {
    for (let j = 0; j < left.size()[1]; j++) {
      left.subset(math.index(i, j), 2 * (anchors[i].coord[j] - anchors[aCount - 1].coord[j]));
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
      Math.pow(anchors[i].coord[0], 2) - Math.pow(anchors[aCount - 1].coord[0], 2) +
      Math.pow(anchors[i].coord[1], 2) - Math.pow(anchors[aCount - 1].coord[1], 2) +
      Math.pow(anchors[aCount - 1].distance, 2) - Math.pow(anchors[i].distance, 2)
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
visions = anchors =
[ { uuid: 'FDA50693-A4E2-4FB1-AFCF-C6EB07647825',
    major: 10001,
    minor: 19899,
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