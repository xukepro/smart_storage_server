let assert = require("http-assert");
let express = require("express");
let jwt = require("jsonwebtoken");
let respond = require("../../lib/utils").respond;
let router = express.Router();
let log;
let mongoClient;
let params = require("../../middleware/params");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/login");
  mongoClient = globalValues.mongoClient;
  return router;
};

router.route("/").post(params(["username", "password"]), (req, res, next) => {
  let { username, password } = req.body;

  mongoClient
    .User({ username, password })
    .save()
    .then((user) => {
      log.info(`add user: ${username}`);
      respond(res, 200, { user }, "success");
    })
    .catch((err) => {
      next(err);
    });
});