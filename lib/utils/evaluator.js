
const NS_PER_SEC = 1e9;
const fs = require('fs');

let options = {
	flags: 'a',     // append模式
	encoding: 'utf8',  // utf8编码
};

class Evaluator {
	constructor(path = './evaluator.txt') {
		this.timeArr = [];
		this.out = fs.createWriteStream(path, options);
		this.logger = new console.Console(this.out);
		this.timer = 0;
		this.timeDiff = [];
	}
	cyclic() {
		this.timer++;
		this.timeArr = [];
		this.timeDiff = [];
	}
	record() {
		let time = process.hrtime();
		let wholeTime = time[0] + time[1] / NS_PER_SEC;

		this.timeArr.push(wholeTime);
		if (this.timeDiff.length === 0) {
			this.timeDiff.push(wholeTime);
		} else {
			this.timeDiff.push(wholeTime - this.timeDiff[0]);
			this.timeDiff[0] = wholeTime;
		}
	}
	handleLine(desc, flag = false) {
		if (flag) {
			this.logger.log(desc + ': ' + this.timeDiff);
		} else {
			this.logger.log(desc + ': ' + this.timeArr);
		}
	}
	print(desc, flag = false) {
		if (flag) {
			this.timeDiff.shift();
			console.log(desc + ': ' + this.timeDiff);
		} else {
			console.log(desc + ': ' + this.timeArr);
		}
	}
}

module.exports = Evaluator;
