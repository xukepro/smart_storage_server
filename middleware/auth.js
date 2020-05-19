const jwt = require("jsonwebtoken");
const assert = require("http-assert");

module.exports = (model, level) => (req, res, next) => {
  const token = req.headers.token;
  assert(token, 401, "请先登录");
  let result;
  try {
    result = jwt.verify(token, req.app.get("secret"));
    // console.log(result)
    assert(result, 401, "请先登录");
  } catch (error) {
    assert(null, 401, "请先登录");
  }

  model.findById(result.id).populate({ path: "tags"}).then((user) => {
    // console.log(user)
    assert(user, 401, "请先登录");
    req.user = user;
    req.level = level;
    next();
  }).catch((err) => {
    next(err);
  });
};
