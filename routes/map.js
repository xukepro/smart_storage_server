var validator = require('validator');

var log = require('log4js').getLogger('/map');

module.exports = function init(request, wsConnection) {
  wsConnection.init(request, 'map', 'utf8', function(message) {
    try {
      messageHandler(message, wsConnection.maps[request.resourceURL.query.user_id]);
    } catch (e) {
      console.error(e);
    }
  });
};

function messageHandler(message, connection) {
  connection.floorInfo = JSON.parse(message.utf8Data); // save floorInfo from webpage
  log.info('saved floorInfo.');
}