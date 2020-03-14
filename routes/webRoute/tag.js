let assert = require("http-assert");
let express = require("express");
let mongoose = require("mongoose");
let respond = require("../../lib/utils").respond;
let AdminRouter = express.Router();
let UserRouter = express.Router();
let log;
let mongoClient;
let tags;
let { checkQuery, checkBody } = require("../../middleware/check");

module.exports = function init (globalValues) {
  log = globalValues.log.getLogger("/tag");
  mongoClient = globalValues.mongoClient;
  tags = globalValues.tags;

  return { AdminRouter, UserRouter };
};

/* 查找tag */
const getTag = (req, res, next) => {
  let level = req.level;
  let { tId } = req.query;
  let { _id, username } = req.user;
  let getTags;
  if (level === "admin") {
    getTags = tId ? mongoClient.Tags.findOne({ tId }).populate({ path: "user"})
    : mongoClient.Tags.find().populate({ path: "user", select: 'username' });
  } else if (level === "user") {
    // 用户获得tag 同时查询tId和user匹配项
    let user = mongoose.Types.ObjectId(_id);
    getTags = tId ? mongoClient.Tags.findOne({ tId, user })
    : mongoClient.Tags.find({ user });
  }

  getTags
    .then((tag) => {
      assert(tag, 200, { code: 3001, message: "tag don't exist" });
      log.info(`${level === "admin" ? "admin" : "user: " + username} get tag`);
      respond(res, 200, { tag });
    })
    .catch((err) => {
      next(err);
    });
};
AdminRouter.route("/").get(getTag);
UserRouter.route("/").get(getTag);

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

/* 添加tag */
const addTag = (req, res, next) => {
  let level = req.level;
  let { tId, description } = req.body;
  //用户添加tag不需要传username
  let username = level === "admin" ? req.body.username : req.user.username;
  assert(tags.indexOf(tId) === -1, 200, { code: 3001, message: "tag already exist" });
  /* user tId建立关系 */
  mongoClient.User.findOne({ username })
    .then((user) => {
      assert(user, 200, { code: 3003, message: "user don't exist" });
      return mongoClient
        .Tags({ tId: tId, user: user._id, description: description ? description : ""})
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
AdminRouter.route("/").post(checkBody(["tId", "username"]), addTag);
UserRouter.route("/").post(checkBody(["tId"]), addTag);

/* 修改tag */
const updateTag = (req, res, next) => {
  let level = req.level;
  let user = req.user;
  //根据id改tId和description
  let { id, tId, description } = req.body;

  if (level === "user") {
    // 如果是用户调用，判断用户是否拥有该tId
    let isOwned = false;
    user.tags.forEach((item) => {
      if (item._id.toString() === id) {
        isOwned = true;
      }
    })
    assert(isOwned, 200, { code: 3003, message: "you don't have this tag" });
  }

  let condition = {};
  if (tId) {
    condition.tId = tId;
  }
  if (description) {
    condition.description = description;
  }
  mongoClient.User.find
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
  let level = req.level;
  let user = req.user;
  if (level === "user") {
    // 如果是用户调用，判断用户是否拥有该tId
    let isOwned = false;
    user.tags.forEach((item) => {
      if (item._id.toString() === id) {
        isOwned = true;
      }
    })
    assert(isOwned, 200, { code: 3003, message: "you don't have this tag" });
  }

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
  let level = req.level;
  let user = req.user;
  if (level === "user") {
    // 如果是用户调用，判断用户是否拥有该tId
    let isOwned = false;
    user.tags.forEach((item) => {
      if (item.tId === tId) {
        isOwned = true;
      }
    })
    assert(isOwned, 200, { code: 3003, message: "you don't have this tag" });
  }
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
