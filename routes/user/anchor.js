let express = require("express");
let assert = require("http-assert");
let router = express.Router();
let respond = require("../../lib/utils").respond;
let log;
let mongoClient;
let anchors;
// let { checkBody } = require("../../middleware/params");

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
