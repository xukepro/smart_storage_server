var mongoClient = require("../lib/mongoClient");
var Evaluator = require("../lib/utils").evaluator;
var evaluator = new Evaluator("evaluate.txt");

let math = require("mathjs");

class LocationManager {
  constructor (globalValues) {
    this.log = globalValues.log.getLogger("locManager");
    this.rcoords = globalValues.rcoords;
    this.FactorA = globalValues.config.solve.FactorA;
    this.FactorN = globalValues.config.solve.FactorN;
    this.deploymentHeight = globalValues.config.solve.deploymentHeight;
    this.TRItimeout = globalValues.config.solve.TRItimeout;
    this.DOPWeight = globalValues.config.solve.DOPWeight;
  }

  /*---------------- 最大似然求解位置 -----------------/
  Sample:
  input = {
    data: [
      ["XXXXX", -XX],
      [...],
      ...
    ],
    previous: [
      { pos: [XX.X, XX.X], weight: -XX.X, DOP: XX.X },
      {...}
    ],
    timestamp: XXXXXXXXX
  }
  /-------------------------------------------------*/
  locate (input, result) {
    // 参考点数组（beacon或anchor）
    var refps = [];
    var thisWeight = 0;

    let rUse = 3;
    // var source = JSON.parse(JSON.stringify(input.data));
    var source = input.data;

    // 得到refps数组，包含每个未知点参考点的距离，rUse为算法使用参考点个数
    while (source.length > 0) {
      var refpoint = source.shift();
      if (Object.prototype.hasOwnProperty.call(this.rcoords, refpoint[0])) {
        // 填充参考点坐标信息
        // refpoint.push(...rcoords[refpoint[0]]);
        refpoint.push.apply(refpoint, this.rcoords[refpoint[0]]);
      } else {
        continue;
      }
      var dis;
      if (refpoint[1] < 0) {
        // 根据rssi计算距离
        dis = this.distanceFormRssi(refpoint[1], refpoint[4], refpoint[5]);
      } else {
        // UWB distance
        dis = refpoint[1];
      }
      // 计算本次权值
      thisWeight += refpoint[1] / dis;
      // 考虑参考点部署高度
      var realdis = this.realDistance(dis);
      refpoint.push(realdis);
      refps.push(refpoint);
      // 找到两个有效参考点后结束
      if (refps.length >= rUse - 1) {
        break;
      }
    }

    if (refps.length < rUse - 1) {
      return 0;
    }

    this.log.trace("refps at first: " + JSON.stringify(refps));

    // 寻找第三个参考点，result为返回值
    var bestResult = this.findBestRefpoint(source, refps);
    // 继续寻找使DOP最小的参考点，弃用
    // if (Object.prototype.hasOwnProperty.call(input, 'needBestDOP')) {
    //   if (input.needBestDOP === 1) {
    //     while (bestResult.DOP > 2) {
    //       refps.pop();
    //       let newResult = findBestRefpoint(source, refps);
    //       if (Object.prototype.hasOwnProperty.call(newResult, 'error')) {
    //         break;
    //       }
    //       if (newResult.DOP < bestResult.DOP) {
    //         bestResult = newResult;
    //       }
    //     }
    //     // this.log.debug('selected refps: ' + JSON.stringify(refps, null, 2));
    //   }
    // }

    this.log.trace("reference points used: " + JSON.stringify(refps));
    this.log.trace("bestResult: " + JSON.stringify(bestResult));

    result.weight = thisWeight + bestResult.weight;
    result.pos = bestResult.pos;
    result.DOP = bestResult.DOP;
    result.timestamp = input.timestamp;
    result.type = "normal";

    if (
      Object.prototype.hasOwnProperty.call(input, "previous") &&
      input.previous.length >= 2
    ) {
      this.log.debug("previous: " + JSON.stringify(input.previous));
      var maxInterval = input.timestamp - input.previous[0].timestamp;
      if (maxInterval <= this.TRItimeout) {
        let slidingList = input.previous;
        slidingList.push(result);
        // 三角加权质心定位
        result.pos = this.WTRIlocation(slidingList);
        result.type = "weighted";
      }
    }

    return 1;
  }

  findBestRefpoint (source, refps) {
    // evaluator.cyclic();
    // evaluator.record();
    var refpoint = this.findVaildRefpoint(source, refps);
    if (Object.prototype.hasOwnProperty.call(refpoint, "error")) {
      return refpoint;
    }

    // evaluator.record();
    // 根据rssi计算距离
    let dis = this.distanceFormRssi(refpoint[1], refpoint[4], refpoint[5]);
    // 计算本次权值
    let weight = refpoint[1] / dis;
    // 考虑参考点部署高度
    let realdis = this.realDistance(dis);
    refpoint.push(realdis);
    refps.push(refpoint);

    // evaluator.record();
    // 最大似然求解位置
    let position = this.MLlocation(refps);
    // evaluator.record();
    let DOP = this.DOPcalcultor(refps, position);
    // evaluator.record();
    // evaluator.print('locate', true, true);

    return {
      weight: weight,
      pos: position,
      DOP: DOP
    };
  }

  findVaildRefpoint (source, existRefps) {
    while (source.length > 0) {
      var refpoint = source.shift();
      if (Object.prototype.hasOwnProperty.call(this.rcoords, refpoint[0])) {
        // 填充参考点坐标信息
        refpoint.push(...this.rcoords[refpoint[0]]);
      } else {
        continue;
      }
      if (this.checkVaildRefpoint(refpoint, existRefps)) {
        return refpoint;
      }
    }
    return { error: 1 };
  }

  // 判断某参考点是否与前两个参考点不共线
  checkVaildRefpoint (refpoint, existRefps) {
    if (
      (refpoint[2] == existRefps[0][2] && refpoint[2] == existRefps[1][2]) ||
      (refpoint[3] == existRefps[0][3] && refpoint[3] == existRefps[1][3])
    ) {
      return false;
    } else {
      return true;
    }
  }

  /*---------------- 最大似然求解位置 -----------------/
  Sample:
  refps = [
    [ "XXXXX", -35,
      29.75, 31, -69.34, 1.221,
      0.0015401080381823758 ],
    [ id, rssi,
      coordX, coordY, factorA, factorN,
      distance ],
    [...],
    ...
  ]
  /-------------------------------------------------*/
  MLlocation (refps) {
    this.log.debug("refps: " + JSON.stringify(refps));
    var aCount = refps.length;

    // var left = math.zeros(aCount - 1, 2);
    // for (let i = 0; i < left.size()[0]; i++) {
    //   for (let j = 0; j < left.size()[1]; j++) {
    //     left.subset(math.index(i, j), 2 * (refps[i][j + 2] - refps[aCount - 1][j + 2]));
    //   }
    // }
    var arrL = new Array(aCount - 1);
    for (let i = 0; i < aCount - 1; i++) {
      arrL[i] = [
        2 * (refps[i][2] - refps[aCount - 1][2]),
        2 * (refps[i][3] - refps[aCount - 1][3])
      ];
    }
    let left = math.matrix(arrL);
    let leftT = math.transpose(left);
    let left2 = math.inv(math.multiply(leftT, left));
    // var right = math.zeros(aCount - 1);
    // for (let i = 0; i < right.size()[0]; i++) {
    //   right.subset(
    //     math.index(i, 0),
    //     Math.pow(refps[i][2], 2) - Math.pow(refps[aCount - 1][2], 2) +
    //     Math.pow(refps[i][3], 2) - Math.pow(refps[aCount - 1][3], 2) +
    //     Math.pow(refps[aCount - 1][6], 2) - Math.pow(refps[i][6], 2)
    //   );
    // }
    var arrR = new Array(aCount - 1);
    for (let i = 0; i < aCount - 1; i++) {
      arrR[i] = [
        Math.pow(refps[i][2], 2) -
          Math.pow(refps[aCount - 1][2], 2) +
          Math.pow(refps[i][3], 2) -
          Math.pow(refps[aCount - 1][3], 2) +
          Math.pow(refps[aCount - 1][6], 2) -
          Math.pow(refps[i][6], 2)
      ];
    }
    let right = math.matrix(arrR);
    var pos = math.multiply(math.multiply(left2, leftT), right);
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
  WTRIlocation (slidingList) {
    var weightedPos = [0, 0];
    var sumWxP = [0, 0];
    var sumW = 0;
    for (let i = 0; i < slidingList.length; i++) {
      sumWxP[0] +=
        (slidingList[i].weight * slidingList[i].pos[0]) /
        Math.pow(slidingList[i].DOP, this.DOPWeight);
      sumWxP[1] +=
        (slidingList[i].weight * slidingList[i].pos[1]) /
        Math.pow(slidingList[i].DOP, this.DOPWeight);
      sumW += slidingList[i].weight / Math.pow(slidingList[i].DOP, this.DOPWeight);
    }
    weightedPos[0] = sumWxP[0] / sumW;
    weightedPos[1] = sumWxP[1] / sumW;

    return weightedPos;
  }

  distanceFormRssi (rssi, factorA, factorN) {
    if (factorA == 0) {
      factorA = this.FactorA;
    }
    if (factorN == 0) {
      factorN = this.FactorN;
    }
    var power = (factorA - rssi) / (10 * factorN);
    return Math.pow(10, power);
  }

  realDistance (distance) {
    if (this.deploymentHeight != 0 && distance > this.deploymentHeight) {
      return Math.sqrt(Math.pow(distance, 2) - Math.pow(this.deploymentHeight, 2));
    }
    return distance;
  }

  /*---------------- 计算几何精度因子 -----------------/
  Sample:
  visions = refps = [
    [ "XXXXX", -35,
      29.75, 31, -69.34, 1.221,
      0.0015401080381823758 ],
    [...],
    ...
  ]
  postion = [ 26.47503500451754, 34.42499963637112 ],
  /-------------------------------------------------*/
  DOPcalcultor (visions, position) {
    let vcount = visions.length;
    if (vcount < 3) {
      return -1;
    }
    var arrA = new Array(vcount);
    for (let i = 0; i < vcount; i++) {
      let dx = visions[i][2] - position[0];
      let dy = visions[i][3] - position[1];
      let dis = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
      arrA[i] = [dx / dis, dy / dis, 1];
    }
    let A = math.matrix(arrA);
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
}

module.exports = LocationManager;