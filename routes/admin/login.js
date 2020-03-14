let assert = require("http-assert");
let express = require("express");
let jwt = require("jsonwebtoken");
let respond = require("../../lib/utils").respond;
let router = express.Router();
let log;
let mongoClient;
let { checkBody } = require("../../middleware/params");
const expirteTime = 60 * 60;

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/login");
  mongoClient = globalValues.mongoClient;
  return router;
};

router.route("/").post(checkBody(["username", "password"]), (req, res, next) => {
  let { username, password } = req.body;
  mongoClient.AdminUser.findOne({ username })
    .select("+password")
    .then((user) => {
      assert(user, 200, { code: 3003, message: "user don't exist" });
      let isValid = require("bcryptjs").compareSync(password, user.password);
      assert(isValid, 200, { code: 3003, message: "password error" });
      // let token = jwt.sign({ id: user._id }, req.app.get("secret"), { expiresIn: expirteTime });
      let token = jwt.sign({ id: user._id }, req.app.get("secret"));
      log.info(`adminUser: ${username} login`);
      respond(res, 200, { username, token }, "success");
    })
    .catch((err) => {
      next(err);
    });
});
