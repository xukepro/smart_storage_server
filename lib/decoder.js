module.exports.tagData = tagData;
function tagData(data) {
  // var aId = data.toString('hex',0,6);
  var rssi = data.readInt8(0);
  var UUID = data.toString('hex', 1, 17);
  var major = pad(data.readUInt16BE(17).toString(), 5);
  var minor = pad(data.readUInt16BE(19).toString(), 5);
  var tId = major + '-' + minor

  return {
    'tId': tId,
    'rssi': rssi
  }
}

function pad(num, n) {
  var len = num.toString().length;
  while (len < n) {
    num = '0' + num;
    len++;
  }
  return num;
}