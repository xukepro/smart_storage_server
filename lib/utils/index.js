var decoder = require('./decoder');
var evaluator = require('./evaluator');
var respond = require('./respond');

module.exports.decoder = decoder;
module.exports.evaluator = evaluator;
module.exports.respond = respond;

module.exports.keysort = function (key, sortType) {
  return function (a, b) {
    return sortType ? ~~(a[key] < b[key]) : ~~(a[key] > b[key]);
  };
};