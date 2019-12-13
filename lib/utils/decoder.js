module.exports.tagData = tagData;
function tagData (sdata) {
  var data = Buffer.from(sdata, "hex");
  // var aId = sdata.toString('hex',0,6);
  var rssi = -data.readUInt8(0);
  var UUID = data.toString("hex", 1, 17);
  var major = pad(data.readUInt16BE(17).toString(), 5);
  var minor = pad(data.readUInt16BE(19).toString(), 5);
  var tId = major + "-" + minor;

  return {
    // 'UUID': UUID,
    tId: tId,
    rssi: rssi
  };
}

module.exports.tagBData = tagBData;
function tagBData (data) {
  console.log(data);
  let pre = data.readUInt16BE(0);
  if (pre !== 0x1211) {
    return;
  }
  let len = data.readUInt8(2);
  let aId = data.toString("hex", 3, 9).toUpperCase();

  let l4 = data.readUInt32BE(13);
  let h4 = data.readUInt32BE(9);
  let timestamp = h4 * 4294967296 + l4;

  let tags = [];
  for (let i = 0; i < len; i++) {
    tags.push(data.toString("hex", 17 + i * 21, 38 + i * 21));
  }
  return { aId, tags, timestamp };
}

function pad (num, n) {
  var len = num.toString().length;
  while (len < n) {
    num = "0" + num;
    len++;
  }
  return num;
}
