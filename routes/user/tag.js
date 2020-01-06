let assert = require("http-assert");
let express = require("express");
let respond = require("../../lib/utils").respond;
let AdminRouter = express.Router();
let UserRouter = express.Router();
let log;
let mongoClient;
let tags;
let paramsMiddleware = require("../../middleware/paramsMiddleware");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/tag");
  mongoClient = globalValues.mongoClient;
  tags = globalValues.tags;

  return { AdminRouter, UserRouter };
};

/* 管理员查找 */
const getTags = (req, res, next) => {
  let { tId } = req.body;
  let getTags;
  if (tId) {
    getTags = mongoClient.Tags.findOne({ tId }).populate({ path: "user"});
  } else {
    getTags = mongoClient.Tags.find().populate({ path: "user", select: 'username -_id' });
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
};
AdminRouter.route("/").get(getTags);

/* 用户查找自己拥有的全部tags */
const getTagsByUsername = ( req, res, next ) => {
  let { username } = req.body;
  mongoClient.User.findOne({ username })
    .populate({ path: "tags" })
    .then((user) => {
      assert(user, 400, { code: 3003, message: "user don't exist" });
      assert(user.tags, 400, { code: 3003, message: "user have no tags" });
      log.info(`get all tag`);
      respond(res, 200, { tags: user.tags });
    });
};
UserRouter.route("/").get(paramsMiddleware(["username"]), getTagsByUsername);

/* 添加tag */
const addTag = (req, res, next) => {
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
};
UserRouter.route("/").post(paramsMiddleware(["tId", "username"]), addTag);
AdminRouter.route("/").post(paramsMiddleware(["tId", "username"]), addTag);

/* 修改tag */
const updateTag = (req, res, next) => {
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
};
UserRouter.route("/").put(paramsMiddleware(["id"]), updateTag);
AdminRouter.route("/").put(paramsMiddleware(["id"]), updateTag);

/* 删除该用户的tag */
const deleteTag = (req, res, next) => {
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
};
UserRouter.route("/").delete(paramsMiddleware(["id"]), deleteTag);
AdminRouter.route("/").delete(paramsMiddleware(["id"]), deleteTag);
