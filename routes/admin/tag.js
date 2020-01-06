let assert = require("http-assert");
let express = require("express");
let respond = require("../../lib/utils").respond;
let router = express.Router();
let log;
let mongoClient;
let tags;
let paramsMiddleware = require("../../middleware/paramsMiddleware");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/tag");
  mongoClient = globalValues.mongoClient;
  tags = globalValues.tags;

  return router;
};

/* 查找 */
router.route("/").get((req, res, next) => {
  let { tId } = req.body;
  let getTags;
  if (tId) {
    getTags = mongoClient.Tags.findOne({ tId }).populate({ path: "user" });
  } else {
    getTags = mongoClient.Tags.find().populate({ path: "user" });
  }
  getTags
    .then((tag) => {
      assert(tag, 400, { code: 3001, message: "tag don't exist" });
      log.info(`get tag`);
      respond(res, 200, { tag });
    })
    .catch((err) => {
      next(err);
    });
});

/* 添加 */
router.route("/").post(paramsMiddleware(["tId", "username"]), (req, res, next) => {
  let { tId, username, description } = req.body;
  console.log(tags.indexOf(tId));
  assert(tags.indexOf(tId) === -1, 400, { code: 3001, message: "tag already exist" });
  /* user tId建立关系 */
  mongoClient.User.findOne({ username })
    .then((user) => {
      assert(user, 400, { code: 3003, message: "user don't exist" });
      return mongoClient
        .Tags({ tId: tId, user: user._id, description: description ? description : "" })
        .save()
        .then((tag) => {
          user.tags.push(tag._id);
          return user.save();
        });
    })
    .then((user) => {
      // tags.push(tId);
      log.info(`add tag: ${tId} belong to user: ${username}`);
      respond(res, 200, null, "success");
    })
    .catch((err) => {
      next(err);
    });
});

/* 修改 */
router.route("/").put(paramsMiddleware(["id"]), (req, res, next) => {
  let { id, tId, description } = req.body;
  let condition = {};
  if (tId) {
    condition.tId = tId;
  }
  if (description) {
    condition.description = description;
  }
  mongoClient.Tags.findByIdAndUpdate(id, condition)
    .then((tag) => {
      // console.log(tag);
      assert(tag, 400, { code: 3003, message: "tag don't exist" });
      // if (condition.tId) {
      //   tags.splice(tags.indexOf(tId), 1, condition.tId);
      // }
      log.info(`modify tag: ${tId} with condition: ${condition}`);
      respond(res, 200, null, "success");
    })
    .catch((err) => {
      next(err);
    });
});

/* 删除 */
router.route("/").delete(paramsMiddleware(["id"]), (req, res, next) => {
  let { id } = req.body;

  mongoClient.Tags.findByIdAndRemove(id).then((tag) => {
    assert(tag, 400, { code: 3003, message: "tag don't exist" });
    mongoClient.User.updateOne(
      { tags: { $in: [id] } },
      { $pull: { tags: id } },
      { multi: true }
    ).then((result) => {
      // tags.splice(tags.indexOf(tag.tId), 1);
      log.info(`delete tag: ${tag.tId} and update user`);
      respond(res, 200, { result }, "success");
    });
  });
});
