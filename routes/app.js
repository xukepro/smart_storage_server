var validator = require('validator');

module.exports = function init(request, wsConnection) {
  wsConnection.init(request, 'app', 'utf8', function(message) {
    try {
      messageHandler(message);
    } catch (e) {
      console.error(e);
    }
  });
};

function messageHandler(message) {
  // var json = JSON.parse(message.utf8Data);
  // json.timestamp = tms;
  // console.log('\nMessage from ' + query.user_id + '(' + query.client_type + ') at ' + tms + ':');
  // console.log(JSON.stringify(json.tags));

  // for (let tag of json.tags) {
  //   let tId = tag[0];
  //   if (scaned_tags[tId] == undefined) { // scaned this tag for the first time
  //     scaned_tags[tId] = {'timestamp': 0};
  //   }
  //   let this_ts = parseInt(json.timestamp / 1000)
  //   if (scaned_tags[tId] == undefined ||
  //       ( this_ts != (scaned_tags[tId]['timestamp']) &&
  //         this_ts != (scaned_tags[tId]['timestamp'] + 1))) {
  //     scaned_tags[tId] = {
  //       'timestamp': this_ts,
  //       'aIds': [],
  //       'anchors': []
  //     };
  //   }
  //   let aIndex = scaned_tags[tId]['aIds'].indexOf(json.aId);
  //   if (aIndex == -1) {    
  //     scaned_tags[tId]['aIds'].push(json.aId);
  //     scaned_tags[tId]['anchors'].push({
  //       'aId': json.aId,
  //       'rssi': tag[1]
  //     });
  //   } else {
  //     scaned_tags[tId]['anchors'][aIndex].rssi = tag[1];
  //   }
  // }

  // save anchors message in mongodb
  // MongoClient.connect(url, { useNewUrlParser: true }, function (err, db) {
  //   if (err) throw err;
  //   var dbo = db.db("indoor");
  //   dbo.collection("request").insertOne(json, function (err, res) {
  //     if (err) throw err;
  //     console.log('db insert success');
  //     db.close();
  //   });
  // });
}