var math = require('mathjs');

const I = math.matrix([[1, 0], [0, 1]]);

function KF(A, G, H) {
  this.A = math.matrix(A);
  this.AT = math.transpose(A);
  this.G = math.matrix(G);
  this.H = math.matrix(H);
  this.HT = math.transpose(H);
}

KF.prototype = {
  'x': null,  // state vector
  'P': null,  // Covariance Matrix

  'R': null,  // Measurement Noise Coviarance
  'Q': null,  // Process Noise Covariance

  'A': null,  // State design matrix
  'AT': null,
  'G': null,  // Input design matrix
  'H': null,  // Measurement design matrix
  'HT': null,

  'Inited': false,

  'init': function (X0, P0, R0, Q0) {
    this.x = math.matrix(X0);
    this.P = math.matrix(P0);
    this.R = math.matrix(R0);
    this.Q = math.matrix(Q0);
    this.Inited = true;

    return this.Inited;
  },

  /*---------------- 卡尔曼滤波器更新 -----------------/
  Sample:
  ob = 
  { u: [],  // Linear input variable
    z: [],  // obsversion input variable
    R: [],  // Sensor Noise Covariance(Optional)
    timestamp: 1554861533000,
    task: "xxx"
  }
  /-------------------------------------------------*/
  'update': function (ob) {
    // u: Linear input variable
    let u = ("u" in ob) ? math.matrix(ob.u) : [0, 0];

    // z: obsversion input variable
    let z = ("z" in ob) ? math.matrix(ob.z) : [0, 0];

    // R: Sensor Noise Covariance
    this.R = ("R" in ob) ? ob.R : this.R;

    // Step1:
    // x_k: Predicted State vector / Estimated signal
    let x_k = math.add(this.x, math.multiply(G, u));
    // console.log('1: x: ' + x_k);

    // Step2:
    // p_k: Predicted Covariance Matrix
    let APA = math.multiply(math.multiply(this.A, this.P), this.AT);
    let p_k = math.add(APA, this.Q);
    // console.log('2: p: ' + p_k);

    // Step3:
    // K: Kalman Gain
    let HpH = math.multiply(math.multiply(this.H, p_k), this.HT);
    let pRi = math.inv(math.add(HpH, this.R));
    var K = math.multiply(math.multiply(p_k, this.HT), pRi);
    // console.log('3: K: ' + K);

    // Step4:
    // X_k: new State vector
    let V = math.subtract(z, math.multiply(this.H, x_k));
    let X_k = math.add(x_k, math.multiply(K, V));
    // console.log('4: X: ' + X_k);

    // Step5:
    // P_k: Covariance Matrix
    let KHp = math.multiply(math.multiply(K, this.H), p_k);
    let P_k = math.subtract(p_k, KHp);
    // console.log('5: P: ' + P_k);

    // Set Current state
    this.x = X_k;
    this.P = P_k;

    return this.x.toArray()
  }
};

module.exports = KF;