const jwt = require("jsonwebtoken");
const assert = require("http-assert");

module.exports = (model, level) => (req, res, next) => {
  const token = req.headers.authorization;
  assert(token, 401, "请先登录");
  let result;
  try {
    result = jwt.verify(token, req.app.get("secret"));
    assert(result, 401, "请先登录");
  } catch (error) {
    next(error);
  }

  model.findById(result.id).then((user) => {
    assert(user, 401, "请先登录");
    req.user = user;
    req.levle = level;
    console.log(user);
    next();
  }).catch((err) => {
    next(err);
  });
};