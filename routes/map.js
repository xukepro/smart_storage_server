var validator = require('validator');

module.exports = function init(request, wsConnection) {
  wsConnection.init(request, 'map', 'utf8', function(message) {
    try {
      wsConnection.maps[request.resourceURL.query.user_id].floorInfo = JSON.parse(message.utf8Data); // get floorInfo from webpage
      messageHandler(message);
    } catch (e) {
      console.error(e);
    }
  });
};

function messageHandler(message) {

}