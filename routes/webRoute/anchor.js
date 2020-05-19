let express = require("express");
let assert = require("http-assert");
let AdminRouter = express.Router();
let UserRouter = express.Router();
let respond = require("../../lib/utils").respond;
let log;
let mongoClient;
let anchors;
let check = require("../../middleware/check");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/anchor");
  mongoClient = globalValues.mongoClient;
  anchors = globalValues.anchors;
  return { AdminRouter, UserRouter };
};

/* 查询anchor */
const getAnchor = (req, res, next) => {
  mongoClient.Anchors.find().then((anchors) => {
    log.info("get all anchors");
    respond(res, 200, { anchors });
  });
};
AdminRouter.route("/").get(getAnchor);
UserRouter.route("/").get(getAnchor);

/* 添加 */
const addAnchor = (req, res, next) => {
  let { aId, x, y, A, N } = req.body;
  assert(aId, 400, { code: 3003, message: "no aId" });
  assert(x, 400, { code: 3003, message: "no x" });
  assert(y, 400, { code: 3003, message: "no y" });
  assert(A, 400, { code: 3003, message: "no A" });
  assert(N, 400, { code: 3003, message: "no N" });

  let coords = [parseFloat(x), parseFloat(y), parseFloat(A), parseFloat(N)];
  assert(!anchors[aId], 202, { code: 3001, message: "aId already exist" });
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
AdminRouter.route("/").post(check("body", ["aId", "x", "y", "A", "N"]), addAnchor);

/* 修改 */
const updateAnchor = (req, res, next) => {
  let { id, aId, x, y, A, N } = req.body;
  assert(id, 400, { code: 3003, message: "no id" });

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
AdminRouter.route("/").put(check("body", ["id", "aId", "x", "y", "A", "N"]), updateAnchor);

/* 删除 */
const deleteAnchor = (req, res, next) => {
  let { id } = req.body;
  assert(id, 400, { code: 3003, message: "no id" });
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
AdminRouter.route("/").delete(check("body", ["id"]), deleteAnchor);
