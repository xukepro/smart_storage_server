let express = require("express");
let assert = require("http-assert");
let router = express.Router();
let respond = require("../../lib/utils").respond;
let log;
let mongoClient;
let anchors;
let { checkBody } = require("../../middleware/params");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/coordinate");
  mongoClient = globalValues.mongoClient;
  anchors = globalValues.anchors;

  return router;
};

/* 查询 */
router.route("/").get(function (req, res, next) {
  log.info(`get all anchors`);
  // respond(res, 200, { anchors });
  mongoClient.Anchors.find().then((anchors) => {
    respond(res, 200, { anchors });
  });
});

/* 添加 */
router.route("/").post(checkBody(["aId", "x", "y", "A", "N"]), (req, res, next) => {
  let { aId, x, y, A, N } = req.body;
  let reg = /^-?[0-9]+(.[0-9]+)?$/;
  [x, y, A, N].map((value) => {
    assert(reg.test(value), 200, { code: 3003, message: `${value} is not a number` });
  });
  let coords = [parseFloat(x), parseFloat(y), parseFloat(A), parseFloat(N)];
  assert(!anchors[aId], 200, { code: 3001, message: "aId already exist" });
  mongoClient
    .Anchors({ aId, coords })
    .save()
    .then((anchor) => {
      log.info(`add anchor: ${aId}`);
      respond(res, 200, { anchor }, "success");
    })
    .catch((err) => {
      next(err);
    });
});

/* 修改 */
router.route("/").put(checkBody(["id"]), (req, res, next) => {
  let { id, aId, x, y, A, N } = req.body;
  let reg = /^-?[0-9]+(.[0-9]+)?$/;
  [x, y, A, N].map((value) => {
    if (value) {
      assert(reg.test(value), 200, { code: 3003, message: `${value} is not a number` });
    }
  });
  mongoClient.Anchors.findById(id)
    .then((anchor) => {
      assert(anchor, 200, { code: 3003, message: "anchor don't exist" });
      anchor.aId = aId || anchor.aId;
      anchor.coords = [
        x ? parseFloat(x) : anchor.coords[0],
        y ? parseFloat(y) : anchor.coords[1],
        A ? parseFloat(A) : anchor.coords[2],
        N ? parseFloat(N) : anchor.coords[3]
      ];
      return anchor.save();
    })
    .then((anchor) => {
      log.info(`modify anchor: ${anchor.aId}`);
      respond(res, 200, null, "success");
    })
    .catch((err) => {
      next(err);
    });
});

/* 删除 */
router.route("/").delete(checkBody(["id"]), (req, res, next) => {
  let { id } = req.body;
  mongoClient.Anchors.findByIdAndRemove(id)
    .then((anchor) => {
      assert(anchor, 200, { code: 3003, message: "anchor don't exist" });
      log.info(`delete anchor: ${anchor.aId}`);
      respond(res, 200, null, "success");
    })
    .catch((err) => {
      next(err);
    });
});
