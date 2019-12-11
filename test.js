var Evaluator = require('./lib/utils').evaluator;
var evaluator = new Evaluator('evaluate.txt');

let LIMIT = 1000000;
let arr = new Array(LIMIT);
evaluator.record();
// arr.push(1);
for (let i = 0; i < LIMIT; i++) {
  // arr[i] = i;
  // arr.push(i);
  Math.pow(12.312, 2);
  // 12.312*12.312;
}
evaluator.record();
evaluator.print('pow', true);