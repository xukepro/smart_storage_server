let assert = require("http-assert");

module.exports = (option) => (req, res, next) => {
  option.map((value) => {
    assert(req.body[value], 400, { code: 3000, message: `no ${value}` });
  });
  next();
};
