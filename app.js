var WebSocketServer = require('websocket').server;
var http = require('http');
var https = require('https');
var validator = require('validator');

var config = require('./config/config')
var acoords = require('./data/coordinate').getAcoords;

var locationManager = require('./lib/locationmanager');
var coordConverter = require('./lib/coordConverter');
var decoder = require('./lib/decoder');

var MongoClient = require('mongodb').MongoClient;
var url = "mongodb://localhost:27017/";

// let options = {
//   key: config.sec.key,
//   cert: config.sec.crt
// };

// var server = https.createServer(options, function (request, response) {
//   console.log((new Date()) + ' Received request for ' + request.url);
//   response.writeHead(404);
//   response.end();
// });
// server.listen(config.https_port, function () {
//   console.log((new Date()) + ' Server is listening on port ' + config.https_port);
// });
var server = http.createServer(function (request, response) {
  console.log((new Date()) + ' Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
server.listen(config.http_port, function () {
  console.log((new Date()) + ' Server is listening on port ' + config.http_port);
});

var wssServer = new WebSocketServer({
  httpServer: server,
  // You should not use autoAcceptConnections for production
  // applications, as it defeats all standard cross-origin protection
  // facilities built into the protocol and the browser.  You should
  // *always* verify the connection's origin and decide whether or not
  // to accept it.
  autoAcceptConnections: false
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

var connectionsForMap = {};  // websocket connections for webpages, add floorInfo
var connectionsForRoot = {};  // websocket connections for root node
var connectionsForAnchor = {};  // websocket connections for anchors, add nearset
// var scaned_tags = {};

wssServer.on('request', function (request) {

  var query = request.resourceURL.query;

  if (!originIsAllowed(request.origin) || !query.user_id || !query.client_type) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    console.log('\n' + new Date() + ' Connection from origin ' + request.origin + ' rejected.');
    return;
  }

  var connection = request.accept('echo-protocol', request.origin);
  console.log('\n' + new Date() + ' Connection accepted for user:' + query.user_id + ' of type:' + query.client_type + ' from:' + connection.remoteAddress + '.');

  if (query.client_type === 'map') {
    connectionsForMap[query.user_id] = connection;
  } else if (query.client_type === 'root')  {
    connectionsForRoot[query.user_id] = connection;
  } else if (query.client_type === 'anchor')  {
    connectionsForAnchor[query.user_id] = connection;
    connectionsForAnchor[query.user_id]['nearest'] = [];
  } else { }

  // var str_aId = '', n_aId = 0;
  // for (let aId in connectionsForAnchor) { str_aId += aId+' '; n_aId++; }
  // console.log(n_aId + ' anchors are accepted: [ ' + str_aId + ']');

  connection.on('message', function (message) {
    try {
      if (message.type === 'utf8') {
        // console.log('\nReceive Message from '+query.user_id+'('+query.client_type+') at '+Date.now()+':');
        // let tms = Date.now();
        if (!validator.isJSON(message.utf8Data)){
          console.log('message from ' + query.user_id + ' is not a json string')
          return;
        }
        var json = JSON.parse(message.utf8Data);
        // console.log(JSON.stringify(json, null, 2));

        if (query.client_type === 'map') {
          connectionsForMap[query.user_id].floorInfo = json; // get floorInfo from webpage
          console.log('floorInfo: ' + JSON.stringify(json));

        } else if (query.client_type === 'root') {
          // json = {
          //   anchors: {
          //     '904E9140F930': [
          //       new Buffer("E2FDA50693A4E24FB1AFCFC6EB0764782527110001", 'hex'),
          //       new Buffer("E1FDA50693A4E24FB1AFCFC6EB0764782527110002", 'hex'),
          //       new Buffer("E0FDA50693A4E24FB1AFCFC6EB0764782527110003", 'hex')
          //     ],
          //     '904E9140F931': [
          //       new Buffer("D2FDA50693A4E24FB1AFCFC6EB0764782527110001", 'hex'),
          //       new Buffer("E8FDA50693A4E24FB1AFCFC6EB0764782527110002", 'hex')
          //     ],
          //     '904E9140F932': [
          //       new Buffer("D6FDA50693A4E24FB1AFCFC6EB0764782527110001", 'hex'),
          //       new Buffer("D1FDA50693A4E24FB1AFCFC6EB0764782527110002", 'hex')
          //     ],
          //   },
          //   timestamp: 1554861533000
          // }
          if (!('anchors' in json) || !('timestamp' in json)) {
            console.log('wrong data from ' + query.user_id + '(root)');
            return;
          }
          /*------------ format of tidied_json --------------/
          tidied_json = {
            tags: {
              "10001-00432": [
                {"aId": "00001-00001", "rssi": -44},
                {"aId": "00001-00002", "rssi": -53},
                {"aId": "00001-00003", "rssi": -60}
              ],
              "10001-00433": [
                {"aId": "00001-00001", "rssi": -46},
                {"aId": "00001-00002", "rssi": -52}
              ],
            },
            "timestamp": 1572850520
          }
          /-------------------------------------------------*/
          var tidied_json = {'tags': {}, 'timestamp': json.timestamp};
          for (let aId in json.anchors) {
            for (let data of json.anchors[aId]) {
              var tag = decoder.tagData(data);
              if (!(tag.tId in tidied_json.tags)) {
                tidied_json.tags[tag.tId] = [];
              }
              tidied_json.tags[tag.tId].push({
                'aId': aId,
                'rssi': tag.rssi
              });
            }
          }
          console.log('tidied_json: ' + JSON.stringify(tidied_json));

          let results = {'n': 0, 'tags': {}};
          for (let tId in tidied_json.tags) {
            var anchors = tidied_json.tags[tId];
            if (anchors.length >= 3) {
              // anchors.push({
              //   'aId': '00001-00002',
              //   'rssi': -53
              // });
              // anchors.push({
              //   'aId': '00001-00003',
              //   'rssi': -60
              // });
              anchors.sort(keysort('rssi', true));
              
              var input = {
                'anchors': anchors,
                'timestamp':tidied_json.timestamp
              };
              result = locateForTag(tId, input);
              result.tId = tId;

              if ('pos' in result) {
                results.tags[result.tId] = {
                  'pos': result.pos,
                  'DOP': result.DOP,
                  'weight': result.weight,
                  'timestamp': result.timestamp
                };
                results.n++;
              }
              
            }
          }

          if (results.n == 0) return;
          console.log('\nResults: ' + JSON.stringify(results));
          
          // return results to map
          var answer = JSON.parse(JSON.stringify(results));
          for (let user_id in connectionsForMap) {
            if (typeof(connectionsForMap[user_id].floorInfo) === "undefined") continue;
            console.log('\nReturn Message to ' + user_id + '(map) at ' + Date.now() + ':');
            for (let tId in answer.tags) {
              if (tId === 'n') continue;
              var coord = coordConverter.convert(answer.tags[tId].pos, connectionsForMap[user_id].floorInfo,
                { "length_x": "44", "length_y": "55" }); // to be done
                answer.tags[tId].pos = coord; 
            }
            connectionsForMap[user_id].sendUTF(JSON.stringify(answer));
          }

          // save results in mongodb
          MongoClient.connect(url, { useNewUrlParser: true }, function (err, db) {
            if (err) throw err;
            var dbo = db.db("smart_storage");
            dbo.collection("result").insertOne(results, function (err, res) {
              if (err) throw err;
              console.log('db insert success');
              db.close();
            });
          });

        } else if (query.client_type === 'anchor') {
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
        
        } else { }

      } else if (message.type === 'binary') {
        console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
        connection.sendBytes(message.binaryData);
      }

    } catch (e) {
      // only send error to root
      // if (connectionsForRoot[query.user_id]) {
      //   connectionsForRoot[query.user_id].sendUTF('wrong message');
      //   console.log('wrong message');
      // }
      console.log(e);
    } finally { }
    
  });

  connection.on('close', function (reasonCode, description) {
    console.log('\n' + new Date() + ' Peer ' + connection.remoteAddress + ' disconnected.');
    if (query.client_type === 'map') {
      delete connectionsForMap[query.user_id];
    } else if (query.client_type === 'root') {
      delete connectionsForRoot[query.user_id];
    } else if (query.client_type === 'anchor') {
      delete connectionsForAnchor[query.user_id];
    } else { }
    // str_aId = ''; n_aId = 0;
    // for (let aId in connectionsForAnchor) { str_aId += aId+' '; n_aId++; }
    // console.log(n_aId + ' anchors are reamined: [ ' + str_aId + ']');
  }); 
  
});

function locateForTag(tId, input) {
  console.log('Locating for tag ' + tId + ' using parameters: ');
  console.log(JSON.stringify(input));

  var result = {};
  if (!locationManager.locate(input, result)) {
    return result;
  }
  // console.log('Trilateration result: ' + JSON.stringify(result));

  return result;
}

// check if all rssi is bellow a certain value and is from a same anchor
function checkAllRssi(anchors) {
  if (anchors.length < SIZE_CUPT) {
    return 0;
  }
  var bId = anchors[0].bId
  for (let i = 0; i < anchors.length; i++) {
    if (anchors[i].bId != bId || anchors[i].rssi < -54) {
      return 0;
    }
  }
  return 1;
}

function keysort(key, sortType) {
  return function(a,b){
      return sortType ? ~~(a[key] < b[key]) : ~~(a[key] > b[key]);
  }
}