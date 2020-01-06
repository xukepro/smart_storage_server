let express = require('express');
let assert = require("http-assert");
let router = express.Router();
let respond = require('../../lib/utils').respond;
let log;
let mongoClient;
let rcoords;
let paramsMiddleware = require('../../middleware/paramsMiddleware');

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/coordinate");
  mongoClient = globalValues.mongoClient;
  rcoords = globalValues.rcoords;

  return router;
};

/* 查询 */
router.route('/').get(function (req, res, next) {
  log.info(`get all rcoords`);
  respond(res, 200, { 'rcoords': rcoords });
});

/* 添加 */
router.route('/').post(paramsMiddleware(['aId', 'x', 'y', 'A', 'N']), (req, res, next) => {
  let { aId, x, y, A, N } = req.body;
  let coords = [ parseFloat(x), parseFloat(y), parseFloat(A), parseFloat(N) ];
  assert(!rcoords[aId], 400, { code: 3001, message: "aId already exist" });
  mongoClient.Coords({aId, coords}).save().then((rcoord)=>{
    console.log(rcoord);
    rcoords[aId] = coords;
    log.info(`add coord: ${aId}`);
    respond(res, 200, { rcoord }, "success");
  }).catch((err) => {
    next(err);
  });
});

/* 修改 */
router.route('/').put(paramsMiddleware(['aId']), (req, res, next) => {
  let { aId, x, y, A, N } = req.body;
  assert(rcoords[aId], 400, { code: 3001, message: "aId don't exist" });
  let rcoord = rcoords[aId];
  rcoord = [
    x ? parseFloat(x) : rcoord[0],
    y ? parseFloat(y) : rcoord[1],
    A ? parseFloat(A) : rcoord[2],
    N ? parseFloat(N) : rcoord[3],
  ];
  mongoClient.Coords.updateOne({aId}, {coords: rcoord}).then((result) => {
    console.log(result);
    rcoords[aId] = rcoord;
    log.info(`modify coord: ${aId} ${rcoord}`);
    respond(res, 200, { result }, "success");
  }).catch((err) => {
    next(err);
  });
});

/* 删除 */
router.route('/').delete(paramsMiddleware(['aId']), (req, res, next) => {
  let { aId } = req.body;
  assert(rcoords[aId], 400, { code: 3001, message: "aId don't exist" });
  mongoClient.Coords.deleteOne({ aId }).then((result) => {
    console.log(result);
    delete rcoords[aId];
    log.info(`delete coord: ${aId}`);
    respond(res, 200, { result }, "success");
  }).catch((err) => {
    next(err);
  });
});