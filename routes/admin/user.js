let assert = require("http-assert");
let express = require("express");
let respond = require("../../lib/utils").respond;
let router = express.Router();
let log;
let mongoClient;
let tags;
let params = require("../../middleware/params");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/user");
  mongoClient = globalValues.mongoClient;
  tags = globalValues.tags;
  return router;
};

/* 查询用户 */
router.route("/").get((req, res, next) => {
  let { username } = req.body;
  let getUser;
  if (username) {
    getUser = mongoClient.User.findOne({ username });
  } else {
    getUser = mongoClient.User.find();
  }
  getUser
    .populate({ path: "tags" })
    .select("+password")
    .then((users) => {
      assert(users, 400, { code: 3001, message: "user don't exist" });
      log.info("get users");
      respond(res, 200, { users });
    })
    .catch((err) => {
      next(err);
    });
});

/* 添加用户 */
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

/* 修改用户 */
router.route("/").put(params(["id"]), (req, res, next) => {
  let { id, username, password } = req.body;
  let condition = {};
  if (username) {
    condition.username = username;
  }
  if (password) {
    condition.password = password;
  }
  mongoClient.User.findByIdAndUpdate(id, condition)
    .then((user) => {
      assert(user, 400, { code: 3003, message: "user don't exist" });
      log.info(`modify user: ${user.username} with condition: ${condition}`);
      respond(res, 200, null, "success");
    })
    .catch((err) => {
      next(err);
    });
});

/* 删除用户 */
router.route("/").delete(params(["id"]), (req, res, next) => {
  let { id } = req.body;

  mongoClient.User.findByIdAndRemove(id)
    .then((user) => {
      assert(user, 400, { code: 3003, message: "user don't exist" });
      /* 删除user所有的tag */
      return mongoClient.Tags.find({ user: id }).then((tags) => {
        // let deleteUser = mongoClient.User.deleteOne({ username });
        let deleteTag = mongoClient.Tags.deleteMany({ user: id });
        return Promise.all([user, tags, deleteTag]);
      });
    })
    .then((results) => {
      let user = results[0];
      let tags = results[1];
      let deleteTags = results[2];

      for (let tag in tags) {
        tags.splice(tags.indexOf(tag.tId), 1);
      }
      log.info(`delete user: ${user.username} and tags: ${tags.map((v) => v.tId)}`);
      respond(res, 200, { deleteTags }, "success");
    })
    .catch((err) => {
      next(err);
    });
});
