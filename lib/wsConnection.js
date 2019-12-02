var validator = require('validator');

var connectionsForApp = {};  // websocket connections for apps, add 'nearset'
var connectionsForRoot = {};  // websocket connections for root node of anchors
var connectionsForMap = {};  // websocket connections for webpages, add 'floorInfo'

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
};

function init(request, type, message_type, callback) {
  let query = request.resourceURL.query;

  if (!originIsAllowed(request.origin) || !query.user_id) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    console.log(new Date() + ' echo-protocol connection rejected from ' + request.origin);
    return;
  }

  var connection = connect(request.accept(request.origin), type, query.user_id);
  console.log(new Date() + ' echo-protocol connection accepted from ' + connection.remoteAddress);

  connection.on('close', function (reasonCode, description) {
    disconnect(connection, type, query.user_id);
    console.log(new Date() + ' Peer ' + connection.remoteAddress + ' disconnected.');
  });

  connection.on('message', function (message) {
    if (message.type != message_type) {
      return;
    }

    console.log('\nReceive Message from ' + query.user_id + '(' + type + ') at ' + Date.now() + ':');
    // let tms = Date.now();
    if (!validator.isJSON(message.utf8Data)) {
      console.log('message from ' + query.user_id + '(' + type + ')' + ' is not a json string')
      return;
    }
    console.log(message.utf8Data);
    callback(message);
  });
}

function connect(connection, type, id) {
  switch (type) {
    case 'app':
      connectionsForApp[id] = connection;
      connectionsForApp[id]['nearest'] = [];
      break;
    case 'root':
      connectionsForRoot[id] = connection;
      break;
    case 'map':
      connectionsForMap[id] = connection;
      break;
    default:
      break;
  }
  return connection;
}

function disconnect(type, id) {
  switch (type) {
    case 'app':
      delete connectionsForApp[id];
      break;
    case 'root':
      delete connectionsForRoot[id];
      break;
    case 'map':
      delete connectionsForMap[id];
      break;
    default:
      break;
  }
}

module.exports = {
  init: init,
  apps: connectionsForApp,
  roots: connectionsForRoot,
  maps: connectionsForMap
}