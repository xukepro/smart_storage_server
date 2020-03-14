let assert = require("http-assert");
let express = require("express");
let jwt = require("jsonwebtoken");
let respond = require("../../lib/utils").respond;
let router = express.Router();
let log;
let mongoClient;
let { checkBody, checkQuery } = require("../../middleware/params");
const expirteTime = 60 * 60;

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/login");
  mongoClient = globalValues.mongoClient;
  return router;
};

// 登录
router.route("/login").post(checkBody(["username", "password"]), (req, res, next) => {
  let { username, password } = req.body;
  mongoClient.User.findOne({ username })
    .select("+password")
    .then((user) => {
      assert(user, 200, { code: 3003, message: "user don't exist" });
      let isValid = require("bcryptjs").compareSync(password, user.password);
      assert(isValid, 200, { code: 3003, message: "password error" });
      // let token = jwt.sign({ id: user._id }, req.app.get("secret"), { expiresIn: expirteTime });
      let token = jwt.sign({ id: user._id }, req.app.get("secret"));
      log.info(`user: ${username} login`);
      user.lastLoginTime = Date.now();
      user.save()
      respond(res, 200, { username, token }, "success");
    })
    .catch((err) => {
      next(err);
    });
});

// 注册
router.route("/register").post(checkBody(["username", "password", "email"]), (req, res, next) => {
  let { username, password, email } = req.body;

  mongoClient
    .User({ username, password, email })
    .save()
    .then((user) => {
      log.info(`add user: ${username}`);
      respond(res, 200, { user }, "success");
    })
    .catch((err) => {
      next(err);
    });
});

// 找回密码
router.route("/account/getBackPassword").post(checkBody(["username", "password", "email"]), (req, res, next) => {
  let { username, password, email } = req.body;

  mongoClient
    .User.findOne({ username, email })
    .then((user) => {
      assert(user, 200, { code: 3003, message: "user or email error" });
      user.password = password;
      return user.save();
    }).then((user) => {
      log.info(`get back password of user: ${username}`);
      respond(res, 200, { user }, "success");
    })
    .catch((err) => {
      next(err);
    });
});

// 修改密码
router.route("/account/updatePassword").post(checkBody(["username", "oldPassword", "newPassword"]), (req, res, next) => {
  let { username, oldPassword, newPassword } = req.body;

  mongoClient.User.findOne({ username })
    .select("+password")
    .then((user) => {
      assert(user, 200, { code: 3003, message: "user don't exist" });
      let isValid = require("bcryptjs").compareSync(oldPassword, user.password);
      assert(isValid, 200, { code: 3003, message: "password error" });
      log.info(`update password of user: ${username}`);
      user.password = newPassword;
      return user.save()
    }).then((user) => {
      respond(res, 200, { user }, "success");
    })
    .catch((err) => {
      next(err);
    });
});

// 检查用户名是否存在
router.route("/account/checkName").get(checkQuery(["username"]), (req, res, next) => {
  let { username } = req.query;

  mongoClient.User.findOne({ username })
    .then((user) => {
      let isExisted = false;
      if (user) {
        isExisted = true;
      }
      respond(res, 200, { isExisted }, "success");
    })
    .catch((err) => {
      next(err);
    });
});
