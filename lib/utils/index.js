var decoder = require('./decoder');

module.exports.tidyRootJSON = function (json) {
  var tidied_json = { 'tags': {}, 'timestamp': json.timestamp };
  for (let aId in json.anchors) {
    for (let data of json.anchors[aId]) {
      if (data.length != 42) continue;
      let tag = decoder.tagData(data);
      if (tag.rssi >= 0 || tag.rssi < -128) continue;
      if (!(tag.tId in tidied_json.tags)) {
        tidied_json.tags[tag.tId] = [];
      }
      tidied_json.tags[tag.tId].push([aId, tag.rssi]);
    }
  }
  return tidied_json;
}

module.exports.keysort = function (key, sortType) {
  return function (a, b) {
    return sortType ? ~~(a[key] < b[key]) : ~~(a[key] > b[key]);
  }
}