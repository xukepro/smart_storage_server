module.exports.tagData = tagData;
function tagData(sdata) {
  var data = Buffer.from(sdata, 'hex');
  // var aId = sdata.toString('hex',0,6);
  var rssi = data.readInt8(0);
  var UUID = data.toString('hex', 1, 17);
  var major = pad(data.readUInt16BE(17).toString(), 5);
  var minor = pad(data.readUInt16BE(19).toString(), 5);
  var tId = major + '-' + minor

  return {
    'UUID': UUID,
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