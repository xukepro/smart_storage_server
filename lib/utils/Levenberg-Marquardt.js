let math = require("mathjs");

const tao = 10 ** -3;
const thresholdStop = 10 ** -15;
const thresholdStep = 10 ** -15;
const thresholdResidual = 10 ** -15;
const residualMemory = [];

/**
 * construct a user function
 * @param {*} params (paramsNum, 1)
 * @param {*} inputData (dataNum, 2)
 * @returns (dataNum, 1)
 */
const disFunc = (params, inputData) => {
  let x = params[0][0];
  let y = params[1][0];
  let res = [];
  for (let row of inputData) {
    res.push([
      math.sqrt(
        math.pow((x - row[0]), 2) +
        math.pow((y - row[1]), 2)
      )
    ]);
  }
  return res;
};

/**
 * calculating the derive of pointed parameter
 * @param {*} params (paramsNum, 1)
 * @param {*} inputData (dataNum, 2)
 * @param {*} paramIndex number
 * @returns (dataNum, 1)
 */
const calDeriv = (params, inputData, paramIndex) => {
  let param1 = JSON.parse(JSON.stringify(params));
  let param2 = JSON.parse(JSON.stringify(params));
  param1[paramIndex][0] += 0.000001;
  param2[paramIndex][0] -= 0.000001;
  let dataEstimateOutput1 = disFunc(param1, inputData);
  let dataEstimateOutput2 = disFunc(param2, inputData);
  // let deriv = [];
  // for (let i in dataEstimateOutput1) {
  //   deriv.push([(dataEstimateOutput1[i] - dataEstimateOutput2[i]) / 0.000002]);
  // }
  return math.divide(math.subtract(dataEstimateOutput1, dataEstimateOutput2), 0.000002);
};

/**
 * calculating jacobian matrix
 * @param {*} params (paramsNum, 1)
 * @param {*} inputData (dataNum, 2)
 * @returns (dataNum, paramsNum)
 */
const calJacobian = (params, inputData) => {
  let paramsNum = params.length;
  let dataNum = inputData.length;
  let J = math.zeros(dataNum, paramsNum).toArray();

  for (let i = 0; i < paramsNum; i++) {
    let deriv = calDeriv(params, inputData, i);
    for (let j = 0; j < dataNum; j++) {
      J[j][i] = deriv[j][0];
    }
  }
  // console.log("Jacobian", J);
  return J;
};

/**
 * calculating residual
 * @param {*} params (paramsNum, 1)
 * @param {*} inputData (dataNum, 2)
 * @param {*} outputData (dataNum, 1)
 * @returns (dataNum, 1)
 */
const calResidual = (params, inputData, outputData) => {
  let dataEstimateOutput = disFunc(params, inputData);
  // let residual = [];
  // for (let i = 0; i < inputData.length; i++) {
  //   residual.push(dataEstimateOutput[i] - outputData[i]);
  // }
  // console.log("Residual", residual);
  // residual = ;
  return math.subtract(outputData, dataEstimateOutput);
};

/**
 * get the init u, using equation u=tao*max(Aii)
 * @param {*} A (n, n)
 * @param {*} tao number
 * @returns u
 */
const getInitU = (A, tao) => {
  let m = A.length;
  let Aii = [];
  for (let i = 0; i < m; i++) {
    Aii.push(A[i][i]);
  }
  let u = tao * math.max(Aii);
  return u;
};

/**
 * calculate pseudo-inverse
 * @param {*} A matrix or array
 */
const pseudoInv = (A) => {
  let T = math.transpose(A);
  return math.multiply(
    math.inv(
      math.multiply(
        T, A)),
    T);
};

/**
 * calculate matrix norm
 * @param {*} A
 */
const norm = (A) => {
  let sum = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < A[0].length; j++) {
      sum += math.pow(A[i][j], 2);
    }
  }
  return math.sqrt(sum);
};

/**
 * LM algorithm
 * @param {Number} numIter
 * @param {Array} params (paramsNum, 1)
 * @param {Array} inputData (dataNum, 2)
 * @param {Array} outputData (dataNum, 1)
 */
const LM = (numIter, params, inputData, outputData) => {
  let paramsNum = params.length;
  let k = 0;
  let residual = calResidual(params, inputData, outputData);
  let jacobian = calJacobian(params, inputData);

  let A = math.multiply(math.transpose(jacobian), jacobian);
  let g = math.multiply(math.transpose(jacobian), residual);

  let stop = pseudoInv(g) <= thresholdStop;
  let u = getInitU(A, tao);
  let v = 2;
  let rou = 0;

  while (!stop && k < numIter) {
    k++;
    while (true) {
      let hessionLM = math.add(A, math.multiply(u, math.identity(paramsNum)));
      let step = math.multiply(math.inv(hessionLM), g).toArray();
      if (norm(step) <= thresholdStep) {
        stop = true;
      } else {
        let newParams = math.add(params, step);
        let newResidual = calResidual(newParams, inputData, outputData);
        rou = (math.pow(norm(residual), 2) - math.pow(norm(newResidual), 2)) /
          math.multiply(
            math.transpose(step),
            math.add(math.multiply(u, step), g));
        if (rou > 0) {
          params = newParams;
          residual = newResidual;
          residualMemory.push(math.pow(norm(residual), 2));
          jacobian = calJacobian(params, inputData);
          A = math.multiply(math.transpose(jacobian), jacobian);
          g = math.multiply(math.transpose(jacobian), residual);
          stop = (norm(g) <= thresholdStop) || (math.pow(norm(residual), 2) <= thresholdResidual);
          u = u * math.max(1 / 3, 1 - math.pow((2 * rou - 1), 3));
          v = 2;
        } else {
          u = u * v;
          v = 2 * v;
        }
      }
      if (rou > 0 || stop) {
        break;
      }
    }
  }
  return params;
};


// let numIter = 100;
// let params = [[0], [0]];
// let inputData = [[0, 0], [0, 1], [1, 0]];
// let outputData = [[1.6], [0.9], [1.1]];
// console.log(LM(numIter, params, inputData, outputData));

// console.log(norm([[-0.09990009990277285], [0.09990009990277274]]));
// console.log(disFunc(params, inputData));
// console.log(calDeriv(params, inputData, 0));
// console.log(calJacobian(params, inputData, outputData));
// console.log(calResidual(params, inputData, outputData));

module.exports = LM;