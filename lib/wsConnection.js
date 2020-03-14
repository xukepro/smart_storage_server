var validator = require('validator');

var log = require('log4js').getLogger('websocket');

var connectionsForApp = {};  // websocket connections for apps, add 'nearset'
var connectionsForRoot = {};  // websocket connections for root node of anchors
var connectionsForMap = {};  // websocket connections for webpages, add 'floorInfo'
var numberOfConnections = {'app': 0, 'root': 0, 'map': 0};

function originIsAllowed (origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

function init (request, client_type, message_type, callback) {
  let query = request.resourceURL.query;

  if (!originIsAllowed(request.origin) || !query.user_id) {
    // Make sure we only accept requests from an allowed origin
    request.reject();
    log.info(request.protocol + 'connection rejected from ' + request.origin);
    return;
  }

  var connection = connect(request.accept(request.origin), client_type, query.user_id);
  log.info(request.protocol + 'connection accepted from ' + connection.remoteAddress);

  if (client_type === 'map') {
    connectionsForMap[query.user_id].selectedTag = request.resourceURL.query.tag_id; // save selectedTag from webpage
    log.trace('selectedTag saved.');
  }

  connection.on('close', function (reasonCode, description) {
    disconnect(client_type, query.user_id);
    log.info('Peer ' + connection.remoteAddress + ' disconnected.');
  });

  connection.on('message', function (message) {
    log.info('received ' + message.type + ' message from ' + query.user_id + '(' + client_type + ')');

    if (message_type.indexOf(message.type) === -1) {
      return;
    }
    log.info(message.utf8Data);
    if (message.type === 'utf8' && !validator.isJSON(message.utf8Data)) {
      log.error('message from ' + query.user_id + '(' + client_type + ')' + ' is not a json string.');
      return;
    }

    callback(message, connection);
  });
}

function connect (connection, type, id) {
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
  numberOfConnections[type] += 1;
  return connection;
}

function disconnect (type, id) {
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
  numberOfConnections[type] -= 1;
}

module.exports = {
  init: init,
  apps: connectionsForApp,
  roots: connectionsForRoot,
  maps: connectionsForMap,
  numbers: numberOfConnections
};
