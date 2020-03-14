let assert = require("http-assert");
let express = require("express");
let jwt = require("jsonwebtoken");
let respond = require("../../lib/utils").respond;
let AdminRouter = express.Router();
let UserRouter = express.Router();
let log;
let mongoClient;
let { checkBody, checkQuery } = require("../../middleware/check");
const expirteTime = 60 * 60;

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/login");
  mongoClient = globalValues.mongoClient;
  return { AdminRouter, UserRouter };
};

// 管理员/用户登录
const login = (level) => (req, res, next) => {
  let { username, password } = req.body;
  let findUser;
  if (level === "admin") {
    findUser = mongoClient.AdminUser.findOne({ username })
  } else if (level === "user") {
    findUser = mongoClient.User.findOne({ username })
  }
  findUser
    .select("+password")
    .then((user) => {
      assert(user, 200, { code: 3003, message: "user don't exist" });
      let isValid = require("bcryptjs").compareSync(password, user.password);
      assert(isValid, 200, { code: 3003, message: "password error" });
      // let token = jwt.sign({ id: user._id }, req.app.get("secret"), { expiresIn: expirteTime });
      let token = jwt.sign({ id: user._id }, req.app.get("secret"));
      log.info(`${level === "admin" ? "adminUser" : "user"}: ${username} login`);
      respond(res, 200, { username, token }, "success");
    })
    .catch((err) => {
      next(err);
    });
};

AdminRouter.route("/login").post(checkBody(["username", "password"]), login("admin"));
UserRouter.route("/login").post(checkBody(["username", "password"]), login("user"));

// 用户注册
const userRegister = (req, res, next) => {
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
};
UserRouter.route("/register").post(checkBody(["username", "password", "email"]), userRegister);


// 用户找回密码
const userGetBackPassword = (req, res, next) => {
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
};
UserRouter.route("/getBackPassword").post(checkBody(["username", "password", "email"]), userGetBackPassword);

// 用户修改密码
const userUpdatePassword = (req, res, next) => {
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
};
UserRouter.route("/updatePassword").post(checkBody(["username", "oldPassword", "newPassword"]), userUpdatePassword);

// 检查用户名是否存在
const checkName = (req, res, next) => {
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
};
UserRouter.route("/checkName").get(checkQuery(["username"]), checkName);
