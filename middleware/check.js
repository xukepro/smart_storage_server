// let assert = require("http-assert");
//
// module.exports.checkBody = (option) => (req, res, next) => {
//   option.map((value) => {
//     assert(req.body[value], 400, { code: 3000, message: `no ${value}` });
//   });
//   next();
// };
//
// module.exports.checkQuery = (option) => (req, res, next) => {
//   option.map((value) => {
//     assert(req.query[value], 400, { code: 3000, message: `no ${value}` });
//   });
//   next();
// }


const assert = require("http-assert");
const Joi = require('@hapi/joi');
const schema = Joi.object({
    id: Joi.string().length(24),
    tId: Joi.string(),
    aId: Joi.string(),
    username: Joi.string().min(4).max(12),
    password: Joi.string().min(4).max(12),
    oldPassword: Joi.string().min(4).max(12),
    newPassword: Joi.string().min(4).max(12),
    email: Joi.string().email(),
    x: Joi.number(),
    y: Joi.number(),
    A: Joi.number(),
    N: Joi.number(),
    description: Joi.string().max(100).allow(""),
    searchTId: Joi.string().allow(""),
    searchDesc: Joi.string().max(100).allow(""),
    timesatmp: Joi.object(),
    pageSize: Joi.number().integer().default(8),
    page: Joi.number().integer().min(1).default(1),
});

module.exports = (type, option) => (req, res, next) => {
  option.map((value) => {
    if (type === "query") {
      param = req.query[value];
    } else if (type === "body") {
      param = req.body[value];
    }
    let { error } = schema.validate({[value]: param});
    if (error) {
      assert(null, 400, { code: 3000, message: `参数${value}格式错误: ${error.details[0].message}` });
    }
  });
  next();
};
