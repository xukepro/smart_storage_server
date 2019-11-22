var WebSocketServer = require('websocket').server;
var http = require('http');
var https = require('https');
var validator = require('validator');

var config = require('./config')
var locationManager = require('./lib/locationmanager');
var coordConverter = require('./lib/coordConverter');
var decoder = require('./lib/decoder');
var MongoClient = require('./lib/mongoClient')
var RedisClient = require('./lib/redisClient')

var http_server = http.createServer(function (request, response) {
  console.log((new Date()) + ' HTTP Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
http_server.listen(config.http_port, function () {
  console.log((new Date()) + ' HTTP Server is listening on port ' + config.http_port);
});

var wssServer = null;
if ('sec' in config) {
  let options = { key: config.sec.key, cert: config.sec.crt };
  var https_server = https.createServer(options, function (request, response) {
    console.log((new Date()) + ' HTTPS Received request for ' + request.url);
    response.writeHead(404);
    response.end();
  });
  https_server.listen(config.https_port, function () {
    console.log((new Date()) + ' HTTPS Server is listening on port ' + config.https_port);
  });

  wssServer = new WebSocketServer({
    httpServer: [http_server, https_server],
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
  });
} else {
  wssServer = new WebSocketServer({
    httpServer: http_server,
    autoAcceptConnections: false
  });
}

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
  } else if (query.client_type === 'root') {
    connectionsForRoot[query.user_id] = connection;
  } else if (query.client_type === 'anchor') {
    connectionsForAnchor[query.user_id] = connection;
    connectionsForAnchor[query.user_id]['nearest'] = [];
  } else { }

  // var str_aId = '', n_aId = 0;
  // for (let aId in connectionsForAnchor) { str_aId += aId+' '; n_aId++; }
  // console.log(n_aId + ' anchors are accepted: [ ' + str_aId + ']');

  connection.on('message', function (message) {
    try {
      if (message.type === 'utf8') {
        console.log('\nReceive Message from ' + query.user_id + '(' + query.client_type + ') at ' + Date.now() + ':');
        // let tms = Date.now();
        if (!validator.isJSON(message.utf8Data)) {
          console.log('message from ' + query.user_id + '(' + query.client_type + ')' + ' is not a json string')
          return;
        }
        var json = JSON.parse(message.utf8Data);
        console.log(JSON.stringify(json, null, 2));

        if (query.client_type === 'map') {
          connectionsForMap[query.user_id].floorInfo = json; // get floorInfo from webpage
          console.log('floorInfo: ' + JSON.stringify(json));

        } else if (query.client_type === 'root') {
          // json = {
          //   'anchors': {
          //     '904E9140F916': [
          //       '23FDA50693A4E24FB1AFCFC6EB0764782527110001',
          //       '27FDA50693A4E24FB1AFCFC6EB0764782527110002',
          //       '30FDA50693A4E24FB1AFCFC6EB0764782527110003'
          //     ],
          //     '904E9140F917': [
          //       '28FDA50693A4E24FB1AFCFC6EB0764782527110001',
          //       '21FDA50693A4E24FB1AFCFC6EB0764782527110002'
          //     ],
          //     '904E9140F918': [
          //       '2FFDA50693A4E24FB1AFCFC6EB0764782527110001',
          //       '2DFDA50693A4E24FB1AFCFC6EB0764782527110002'
          //     ],
          //   },
          //   'timestamp': Date.now()
          // }
          if (!('anchors' in json) || !('timestamp' in json)) {
            console.log('wrong data from ' + query.user_id + '(root)');
            return;
          }
          var tidied_json = tidyRootJSON(json);
          console.log('tidied_json: ' + JSON.stringify(tidied_json));

          // save request in mongodb
          MongoClient.insertRequest(json)
            .then(function (res) {
              console.log('Mongo insert success');
            })
            .catch(function (err) {
              throw err;
            });

          let results = { 'n': 0, 'tags': {} };
          var actions = [];
          for (let tId in tidied_json.tags) {
            var anchors = tidied_json.tags[tId];
            if (anchors.length >= 3) {
              anchors.sort(keysort('rssi', true));
              var input = { 'anchors': anchors, 'timestamp': tidied_json.timestamp };
              actions.push(
                locateForTag(tId, input)
                  .then(function (result) {
                    if ('pos' in result) {
                      result.pos = [
                        Number(Number(result.pos[0]).toFixed(6)),
                        Number(Number(result.pos[1]).toFixed(6))
                      ];
                      result.DOP = Number(Number(result.DOP).toFixed(6));
                      result.weight = Number(Number(result.weight).toFixed(3));
                      results.tags[tId] = result;
                      results.n++;
                    }
                  })
                  .catch(function (err) {
                  })
              );
            }
          }

          Promise.all(actions).then(function () {
            if (results.n == 0) return;

            // save results in redis
            RedisClient.insertResults(results)
              .then(function () {
                console.log('Redis insert success');
              })
              .catch(function (err) {
                throw err;
              });

            results.task = '0';
            // save results in mongodb
            MongoClient.insertResults(results)
              .then(function (res) {
                console.log('Mongo insert success');
              })
              .catch(function (err) {
                throw err;
              });

            var answer = JSON.parse(JSON.stringify(results));
            console.log('\nAnswer: ' + JSON.stringify(results));
            // return results to map
            for (let user_id in connectionsForMap) {
              if (typeof (connectionsForMap[user_id].floorInfo) === "undefined") continue;
              console.log('\nReturn Message to ' + user_id + '(map) at ' + Date.now() + ':');
              for (let tId in answer.tags) {
                var coord = coordConverter.convert(
                  answer.tags[tId].pos,
                  connectionsForMap[user_id].floorInfo,
                  { "length_x": "44", "length_y": "55" }
                ); // TO BE DONE
                answer.tags[tId].pos = coord;
              }
              connectionsForMap[user_id].sendUTF(JSON.stringify(answer));
            }
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

function tidyRootJSON(json) {
  var tidied_json = { 'tags': {}, 'timestamp': json.timestamp };
  for (let aId in json.anchors) {
    for (let data of json.anchors[aId]) {
      if (data.length != 42) continue;
      let tag = decoder.tagData(data);
      if (tag.rssi >= 0 || tag.rssi < -128) continue;
      if (!(tag.tId in tidied_json.tags)) {
        tidied_json.tags[tag.tId] = [];
      }
      tidied_json.tags[tag.tId].push({
        'aId': aId,
        'rssi': tag.rssi
      });
    }
  }
  return tidied_json;
}

function locateForTag(tId, input) {
  return new Promise(function (resolve, reject) {
    RedisClient.getPrevious(tId)
      .then(function (previous) {
        input.previous = previous;
        console.log('Locating for tag ' + tId + ' using parameters: ');
        // console.log(JSON.stringify(input));
        var result = {};
        if (locationManager.locate(input, result)) {
          // console.log('Trilateration result: ' + JSON.stringify(result));
          resolve(result);
        } else {
          reject(result);
        }
      })
      .catch(function (err) {
        reject(err);
      });
  });
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
  return function (a, b) {
    return sortType ? ~~(a[key] < b[key]) : ~~(a[key] > b[key]);
  }
}