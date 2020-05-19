let assert = require("http-assert");
let express = require("express");
let mongoose = require("mongoose");
let respond = require("../../lib/utils").respond;
let AdminRouter = express.Router();
let UserRouter = express.Router();
let log;
let mongoClient;
let tags;
let check = require("../../middleware/check");

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
    : mongoClient.Tags.find({ user }).populate({ path: "user"});
  }

  getTags
    .then((tag) => {
      assert(tag, 202, { code: 3001, message: "tag don't exist" });
      log.info(`${level === "admin" ? "admin" : "user: " + username} get tag`);
      respond(res, 200, { tag });
    })
    .catch((err) => {
      next(err);
    });
};
AdminRouter.route("/").get(check("query", ["tId"]), getTag);
UserRouter.route("/").get(check("query", ["tId"]), getTag);

/* 关键词搜索tag */
const searchTags = (req, res, next) => {
  const { searchTId, searchDesc } = req.query;
  let contition = {};
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
AdminRouter.route("/search").get(check("query", ["searchTId", "searchDesc"]),searchTags);

/* 添加tag */
const addTag = (req, res, next) => {
  let level = req.level;
  let { tId, description } = req.body;
  assert(tId, 400, { code: 3000, message:'no tId' });

  //用户添加tag不需要传username
  let username = level === "admin" ? req.body.username : req.user.username;
  assert(username, 400, { code: 3000, message:'no username' });

  assert(tags.indexOf(tId) === -1, 202, { code: 3001, message: "tag already exist" });
  /* user tId建立关系 */
  mongoClient.User.findOne({ username })
    .then((user) => {
      assert(user, 202, { code: 3003, message: "user don't exist" });
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
AdminRouter.route("/").post(check("body", ["tId", "username", "description"]), addTag);
UserRouter.route("/").post(check("body", ["tId", "description"]), addTag);

/* 修改tag */
const updateTag = (req, res, next) => {
  let level = req.level;
  let user = req.user;
  //根据id改tId和description
  let { id, tId, description } = req.body;
  assert(id, 400, { code: 3000, message:'no id' });

  if (level === "user") {
    // 如果是用户调用，判断用户是否拥有该tId
    let isOwned = false;
    user.tags.forEach((item) => {
      if (item._id.toString() === id) {
        isOwned = true;
      }
    })
    assert(isOwned, 202, { code: 3003, message: "you don't have this tag" });
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
      assert(tag, 202, { code: 3003, message: "tag don't exist" });
      log.info(`modify tag: ${tag.tId} with condition: ${condition}`);
      respond(res, 200, null, "success");
    })
    .catch((err) => {
      next(err);
    });
};
UserRouter.route("/").put(check("body", ["id", "tId", "description"]), updateTag);
AdminRouter.route("/").put(check("body", ["id", "tId", "description"]), updateTag);

/* 删除tag */
const deleteTag = (req, res, next) => {
  let { id } = req.body;
  assert(id, 400, { code: 3000, message:'no id' });
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
    assert(isOwned, 202, { code: 3003, message: "you don't have this tag" });
  }

  mongoClient.Tags.findByIdAndRemove(id).then((tag) => {
    assert(tag, 202, { code: 3003, message: "tag don't exist" });
    // 删除tag定位数据的collection
    mongoClient.dbResult.dropCollection(tag.tId);
    // 修改user和tag绑定关系
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
UserRouter.route("/").delete(check("body", ["id"]), deleteTag);
AdminRouter.route("/").delete(check("body", ["id"]), deleteTag);

/* 获得定位数据 */
const getResultsByTag = (req, res, next) => {
  let { tId, timesatmp, pageSize, page} = req.query;
  assert(tId, 400, { code: 3000, message:'no tId' });

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
    assert(isOwned, 202, { code: 3003, message: "you don't have this tag" });
  }
  let condition = {};
  // if (timesatmp) {
  //   condition.timesatmp =
  // }
  assert(mongoClient.Result_tags[tId], 202, { code: 3003, message: "tId don't exist" });
  mongoClient.Result_tags[tId]
    .find(condition)
    .sort({timestamp: -1})
    .limit(pageSize ? parseInt(pageSize) : 10)
    .then((results) => {
      assert(results, 202, { code: 3003, message: "results don't exist" });
      respond(res, 200, { results }, "success");
    }).catch((err) => {
      next(err);
    });
};
UserRouter.route("/data").get(check(["tId", "timesatmp", "pageSize", "page"]), getResultsByTag);
AdminRouter.route("/data").get(check(["tId", "timesatmp", "pageSize", "page"]), getResultsByTag);
