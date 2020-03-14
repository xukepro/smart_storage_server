let assert = require("http-assert");
let express = require("express");
let respond = require("../../lib/utils").respond;
let AdminRouter = express.Router();
let UserRouter = express.Router();
let log;
let mongoClient;
let tags;
let { checkQuery, checkBody } = require("../../middleware/params");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/tag");
  mongoClient = globalValues.mongoClient;
  tags = globalValues.tags;

  return { AdminRouter, UserRouter };
};

/* 管理员查找 */
const getTags = (req, res, next) => {
  let { tId } = req.query;
  let getTags;
  if (tId) {
    getTags = mongoClient.Tags.findOne({ tId }).populate({ path: "user"});
  } else {
    getTags = mongoClient.Tags.find().populate({ path: "user", select: 'username' });
  }
  getTags
    .then((tag) => {
      assert(tag, 200, { code: 3001, message: "tag don't exist" });
      log.info(`get tag`);
      respond(res, 200, { tag });
    })
    .catch((err) => {
      next(err);
    });
};
AdminRouter.route("/").get(getTags);

/* 关键词搜索tag */
const searchTags = (req, res, next) => {
  let contition = {};
  const { searchTId, searchDesc } = req.query;
  if (searchTId) {
    contition = { tId: new RegExp(`^.*${searchTId}.*$`) };
  } else if (searchDesc) {
    contition = { description: new RegExp(`^.*${searchDesc}.*$`) };
  }
  mongoClient.Tags
  .find(contition)
  .then((tag) => {
    respond(res, 200, { tag });
  })
  .catch((err) => {
    next(err);
  })
};
AdminRouter.route("/search").get(searchTags);

/* 用户查找自己拥有的全部tags */
const getTagsByUsername = ( req, res, next ) => {
  let { username } = req.query;
  mongoClient.User.findOne({ username })
    .populate({ path: "tags" })
    .then((user) => {
      assert(user, 200, { code: 3003, message: "user don't exist" });
      assert(user.tags, 200, { code: 3003, message: "user have no tags" });
      log.info(`get all tag`);
      respond(res, 200, { tags: user.tags });
    });
};
UserRouter.route("/").get(checkQuery(["username"]), getTagsByUsername);

/* 添加tag */
const addTag = (req, res, next) => {
  let { tId, username, description } = req.body;
  assert(tags.indexOf(tId) === -1, 200, { code: 3001, message: "tag already exist" });
  /* user tId建立关系 */
  mongoClient.User.findOne({ username })
    .then((user) => {
      assert(user, 200, { code: 3003, message: "user don't exist" });
      return mongoClient
        .Tags({ tId: tId, user: user._id, description: description ? description : "", createdTime: 0})
        .save()
        .then((tag) => {
          user.tags.push(tag._id);
          return user.save();
        });
    })
    .then((user) => {
      log.info(`add tag: ${tId} belong to user: ${username}`);
      respond(res, 200, null, "success");
    })
    .catch((err) => {
      next(err);
    });
};
UserRouter.route("/").post(checkBody(["tId", "username"]), addTag);
AdminRouter.route("/").post(checkBody(["tId", "username"]), addTag);

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
      assert(tag, 200, { code: 3003, message: "tag don't exist" });
      log.info(`modify tag: ${tag.tId} with condition: ${condition}`);
      respond(res, 200, null, "success");
    })
    .catch((err) => {
      next(err);
    });
};
UserRouter.route("/").put(checkBody(["id"]), updateTag);
AdminRouter.route("/").put(checkBody(["id"]), updateTag);

/* 删除tag */
const deleteTag = (req, res, next) => {
  let { id } = req.body;

  mongoClient.Tags.findByIdAndRemove(id).then((tag) => {
    assert(tag, 200, { code: 3003, message: "tag don't exist" });
    mongoClient.User.updateOne(
      { tags: { $in: [id] } },
      { $pull: { tags: id } },
      { multi: true }
    ).then((result) => {
      log.info(`delete tag: ${tag.tId} and update user`);
      respond(res, 200, null, "success");
    });
  }).catch((err) => {
    next(err);
  });
};
UserRouter.route("/").delete(checkBody(["id"]), deleteTag);
AdminRouter.route("/").delete(checkBody(["id"]), deleteTag);

/* 获得定位数据 */
const getResultsByTag = (req, res, next) => {
  let { tId, timesatmp, pageSize, page} = req.query;
  let condition = {};
  // if (timesatmp) {
  //   condition.timesatmp =
  // }
  assert(mongoClient.Result_tags[tId], 200, { code: 3003, message: "tId don't exist" });
  mongoClient.Result_tags[tId]
    .find(condition)
    .sort({timestamp: -1})
    .limit(pageSize ? parseInt(pageSize) : 10)
    .then((results) => {
      assert(results, 200, { code: 3003, message: "results don't exist" });
      respond(res, 200, { results }, "success");
    }).catch((err) => {
      next(err);
    });
};
UserRouter.route("/data").get(checkQuery(["tId"]), getResultsByTag);
AdminRouter.route("/data").get(checkQuery(["tId"]), getResultsByTag);
