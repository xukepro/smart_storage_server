let assert = require("http-assert");

module.exports.checkBody = (option) => (req, res, next) => {
  option.map((value) => {
    assert(req.body[value], 400, { code: 3000, message: `no ${value}` });
  });
  next();
};

module.exports.checkQuery = (option) => (req, res, next) => {
  option.map((value) => {
    assert(req.query[value], 400, { code: 3000, message: `no ${value}` });
  });
  next();
}


// const assert = require("http-assert");
// const Joi = require('@hapi/joi');
// const schema = Joi.object({
//     id: Joi.string(),
//     username: Joi.string().min(4).max(12),
//     password: Joi.string().pattern(new RegExp('^[a-zA-Z0-9_]+$')),
//     email: Joi.string().email(),
// });

// module.exports = (type, option) => (req, res, next) => {
//   option.map((value) => {
//     if (type === "GET") {
//       param = req.query[value];
//     } else if (type === "POST") {
//       param = req.body[value];
//     }
//     let { error, value } = schema.validate([value]: param);
//     assert(!error, 400, { code: 3000, message: `参数验证失败: ${error.details[0].message}` });
//   });
//   next();
// };
