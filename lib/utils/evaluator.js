const NS_PER_SEC = 1e9;
const fs = require("fs");

let options = {
  flags: "a", // append模式
  encoding: "utf8" // utf8编码
};

class Evaluator {
  constructor (path = "./evaluator.txt") {
    this.timeArr = [];
    this.out = fs.createWriteStream(path, options);
    this.logger = new console.Console(this.out);
    this.timer = 0;
    this.timeDiff = [];
  }
  init () {
    this.timer++;
    this.timeArr = [];
    this.timeDiff = [];
  }
  record () {
    let time = process.hrtime();
    let wholeTime = time[0] + time[1] / NS_PER_SEC;
    this.timeArr.push(wholeTime);

    // let len = this.timeArr;
    // if (len > 1) {
    //   this.timeDiff.push(this.timeArr[len - 1] - this.timeArr[len - 2]);
    // }
  }
  print (desc, flag = false, file = false) {
    if (flag) {
      this.diff();
      console.log(desc + ": " + this.timeDiff);
      if (file == true) {
        this.logger.log(desc + ": " + this.timeDiff);
      }
    } else {
      console.log(desc + ": " + this.timeArr);
      if (file == true) {
        this.logger.log(desc + ": " + this.timeArr);
      }
    }
  }
  diff () {
    let len = this.timeArr.length;
    for (let i = 0; i < len - 1; i++) {
      this.timeDiff[i] = this.timeArr[i + 1] - this.timeArr[i];
    }
  }
}

module.exports = Evaluator;
