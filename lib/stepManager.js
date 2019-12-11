var rcoords = require('../data/coordinate').getRcoords;

/*---------------- 行人航位推算算法 -----------------/
Sample:
input =
{ step: [
    0.9759442561109707,
    0.03329375386238098
  ],
  previous: [{...},...],
  timestamp: 1554861533000,
  task: "xxx"
}
/-------------------------------------------------*/
module.exports.PDR = PDR;
function PDR (input, result) {
  let obs = input.previous[input.previous.length - 1];

  let SL = input.step[0];
  let Head = input.step[1];

  result.weight = obs.weight;
  result.pos = [obs.pos[0] + SL * Math.sin(Head), obs.pos[1] + SL * Math.cos(Head)];
  result.DOP = 1;
  result.timestamp = input.timestamp;
  result.iBeaconLoss = obs.iBeaconLoss + 1;
  result.type = 'pdr';

  return 1;
}

/*---------------- 卡尔曼滤波器融合 -----------------/
Sample:
input =
{ step: [
    0.9759442561109707,
    0.03329375386238098
  ],
  previous: [{...},...],
  timestamp: 1554861533000,
  task: "xxx"
}
/-------------------------------------------------*/
module.exports.fusion = fusion;
function fusion (kalmanFilter, input, result) {
  if (!Object.prototype.hasOwnProperty.call(input, 'previous')
    || input.previous.length === 0) {
    return 0;
  }
  let obs = input.previous[input.previous.length - 1];

  if (!kalmanFilter.Inited) {
    kalmanFilter.init(
      obs.pos,
      [[1, 0], [0, 1]],
      [[Math.pow(2.2, 2), 0], [0, Math.pow(2.2, 2)]],
      [[Math.pow(0.6, 2), 0], [0, Math.pow(0.6, 2)]]
    );
  }

  let SL = input.step[0];
  let Head = input.step[1];
  let ob = {
    u: [SL * Math.sin(Head), SL * Math.cos(Head)],
    z: obs.pos,
    R: [[Math.pow(obs.DOP, 2), 0], [0, Math.pow(obs.DOP, 2)]],
    timestamp: input.timestamp,
    task: input.task
  };
  result.weight = obs.weight;
  result.pos = kalmanFilter.update(ob);
  result.DOP = obs.DOP;
  result.timestamp = input.timestamp;
  result.iBeaconLoss = obs.iBeaconLoss + 1;
  result.type = 'fusion';

  return 1;
}

/*--------------------- CUPT ----------------------/
Sample:
nearest_refpoint =
{ id: ["XXXXX-XXXXX", -XX],,
  previous: [{...},...],
  timestamp: 1554861533000,
  task: "xxx"
}
/-------------------------------------------------*/
module.exports.CUPT = CUPT;
function CUPT (kalmanFilter, refpoint, result) {
  if (!kalmanFilter.Inited
    || !Object.prototype.hasOwnProperty.call(rcoords, refpoint[0])) {
    return 0;
  }
  let coord = rcoords[refpoint.id];
  let ob = {
    u: [0, 0],
    z: [coord[0], coord[1]],
    R: [[2, 0], [0, 2]]
  };
  result.pos = kalmanFilter.update(ob);
  result.type = 'cupt';

  return 1;
}