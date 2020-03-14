let express = require("express");
let assert = require("http-assert");
let AdminRouter = express.Router();
let UserRouter = express.Router();
let respond = require("../../lib/utils").respond;
let log;
let mongoClient;
let anchors;
let { checkBody } = require("../../middleware/check");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/coordinate");
  mongoClient = globalValues.mongoClient;
  anchors = globalValues.anchors;
  return { AdminRouter, UserRouter };
};

/* 查询anchor */
const getAnchor = (req, res, next) => {
  let username = req.user.username;
  log.info(`${username} get all anchors`);
  // respond(res, 200, { anchors });
  mongoClient.Anchors.find().then((anchors) => {
    respond(res, 200, { anchors });
  });
};
AdminRouter.route("/").get(getAnchor);
UserRouter.route("/").get(getAnchor);

/* 添加 */
const addAnchor = (req, res, next) => {
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
};
AdminRouter.route("/").post(checkBody(["aId", "x", "y", "A", "N"]), addAnchor);

/* 修改 */
const updateAnchor = (req, res, next) => {
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
};
AdminRouter.route("/").put(checkBody(["id"]), updateAnchor);

/* 删除 */
const deleteAnchor = (req, res, next) => {
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
};
AdminRouter.route("/").delete(checkBody(["id"]), deleteAnchor);
