var decoder = require('./decoder');
var evaluator = require('./evaluator');

module.exports.decoder = decoder;
module.exports.evaluator = evaluator;

module.exports.keysort = function (key, sortType) {
  return function (a, b) {
    return sortType ? ~~(a[key] < b[key]) : ~~(a[key] > b[key]);
  };
};