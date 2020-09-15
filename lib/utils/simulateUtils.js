const maternHCPP =  function (Lambda, threshold, a, b, c, d, r, type) {
    let M = 0;
    let u = Math.random();

    while (u >= Math.exp(-Lambda)) { //泊松点过程判定条件
        u = u * Math.random();
        M = M + 1;
    }

    if (M < 1) M = 1;
    n = M; // number of points

    let u1 = new Array(n);
    let u2 = new Array(n);

    for (let i = 0; i < n; i++) {
        u1[i] = Math.random();
        u2[i] = Math.random();
    }
    // console.log(u1);

    let disth = threshold; // 判决门限

    let pcoords;
    if (type === 1) {// 矩形区域
        //scatter in the [a,b]*[c,d]
        let x = u1.map(value => (b - a) * value);
        let y = u2.map(value => (d - c) * value);

        let Hppp = [[...x], [...y]];

        // step 2 产生标记变量
        let mark = new Array(n); // 对应于Hppp矩阵
        for (let i = 0; i < n; i++) mark[i] = Math.random();

        let marknew = mark.sort();
        let newmatrix = new Array(2);
        newmatrix[0] = new Array(mark.length);
        newmatrix[1] = new Array(mark.length);
        for (let i = 0; i < mark.length; i++) {
            newmatrix[0][i] = Hppp[0][mark.indexOf(marknew[i])];
            newmatrix[1][i] = Hppp[1][mark.indexOf(marknew[i])];
        }


        // 距离判别 极坐标下两点之间距离dis=sqrt((x1-x2)^2+(y1-y2)^2)
        let distance = new Array(mark.length);
        for (let i = 0; i < mark.length; i++) {
            distance[i] = new Array(mark.length);
            for (let j = 0; j < mark.length; j++) {
                distance[i][j] = Math.sqrt(
                    Math.pow(newmatrix[0][i] - newmatrix[0][j], 2) +
                    Math.pow(newmatrix[1][i] - newmatrix[1][j], 2)
                );
            }
        }

        let interindex = 0;
        let indexpoint = new Array(mark.length).fill(1);

        for (let i = 0; i < mark.length; i++)
            for (let j = i + 1; j < mark.length; j++)
                if (indexpoint[i] === 1)
                    if (distance[i][j] < disth)
                        indexpoint[j] = 0;

        let temp = [];
        for (let i = 0; i < mark.length; i++) {
            if (indexpoint[i] == 1) temp.push(i);
        }

        let Mhcpp =new Array(temp.length).fill();
        for (let t = 0; t < temp.length; t++) {
            Mhcpp[t] = new Array(2);
            for (let j = 0; j < 2; j++) {
                Mhcpp[t][j] = newmatrix[j][temp[t]];
            }
        }

        pcoords = Mhcpp;
    }

    // else {// 圆形区域
    //     // 区域半径 r
    //     let R = u1.map(value => r * Math.sqrt(value));
    //     R = Math.sort(R);
    //     let theta = u2.map(value => 2 * pi * value);
    //     let Hppp = [[...R], [...theta]];
    //     // ref: https://blog.csdn.net/weixin_38206454/article/details/78801163

    //     // step 2 产生标记变量
    //     let mark = new Array(n).fill(Math.random()); // 对应于Hppp矩阵
    //     let marknew = sort(mark);
    //     let newmatrix = new Array(2).fill(new Array(n));;
    //     for (let i = 0; i < mark.length; i++) {
    //         for (let j = 0; j < 2; j++) {
    //             newmatrix[j][i] = Hppp[j][mark.indexOf(marknew[i])];
    //         }
    //     }

    //     // 距离判别 极坐标下两点之间距离dis=sqrt((x1-x2)^2+(y1-y2)^2)
    //     let distance = new Array(mark.length).fill(new Array(mark.length));
    //     for (let i; i < mark.length; i++) {
    //         for (let j; j < mark.length; j++) {
    //             distance[i][j] = Math.sqrt(
    //                 Math.pow(newmatrix(1, i), 2) +
    //                 Math.pow(newmatrix(1, j), 2) -
    //                 2 * newmatrix[1][i] * newmatrix[1][j] * Math.cos(newmatrix[2][i] - newmatrix[2][j])
    //             );
    //         }
    //     }

    //     let interindex = 0;
    //     let indexpoint = new Array(mark.length).fill(1);

    //     for (let i = 1; i < mark.length; i++)
    //         for (let j = i + 1; j < mark.length; j++)
    //             if (indexpoint[i] === 1)
    //                 if (distance[i][j] < disth)
    //                     indexpoint[j] = 0;



    //     let temp = [];
    //     for (let i = 0; i < mark.length; i++) {
    //         if (indexpoint[i] == 1) temp.push(i);

    //     }
    //     let Mhcpp = new Array(new Array(temp.length)).fill(2);
    //     for (let t = 0; t < temp.length; t++) {
    //         for (let j = 0; j < 2; j++) {
    //             Mhcpp[t][j] = newmatrix[j][temp[t]];
    //         }
    //     }

    //     pcoords = Mhcpp;
    // }

    return pcoords;
};

const uniform2NormalDistribution = () => {
  var sum = 0.0;
  for (var i = 0; i < 12; i++) {
    sum = sum + Math.random();
  }
  return sum - 6.0;
};

const getNumberInNormalDistribution = (mean, sigma) => mean + (uniform2NormalDistribution() * sigma);

const predictedRSSI = (DistanceMsr) => {
  if (DistanceMsr == 0) return 0;
  let LightSpeedC = 3e8;
  let BlueTooth = 2400 * 1000000;
  let Zigbee = 915.0e6;
  let Freq = BlueTooth;
  let TXAntennaGain = 1;
  let RXAntennaGain = 1;
  let Dref = 1;
  let PTx = 0.001;
  let Lp;
  if (DistanceMsr <= 1.2) Lp = 1;
  else if (DistanceMsr <= 6.5) Lp = Math.exp((1.2 - DistanceMsr) / 4.7);
  else Lp = Math.exp((6.5 - DistanceMsr) / 32.6) * 0.32;

  let sigma = 6;
  let PathLossExponent;
  let rand = Math.random();
  if (Lp > rand) {
    sigma = 3;
    PathLossExponent = 2.2;
  } else {
    sigma = 8.03;
    PathLossExponent = 2.8;
  }
  let mean = 0;
  let Wavelength = LightSpeedC / Freq;
  let PTxdBm = 10 * Math.log(PTx * 1000) / Math.log(10);
  let M = Wavelength / (4 * Math.PI * Dref);
  let Pr0 = PTxdBm + TXAntennaGain + RXAntennaGain - (20 * Math.log(1 / M) / Math.log(10));
  let GaussRandom = getNumberInNormalDistribution(mean, sigma);
  return Pr0 - (10 * PathLossExponent * Math.log(DistanceMsr / Dref) / Math.log(10)) + GaussRandom;
};

module.exports = {
  maternHCPP,
  predictedRSSI,
  getNumberInNormalDistribution
};
