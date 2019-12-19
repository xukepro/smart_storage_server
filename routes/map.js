var log;
var wsConnection;

module.exports = function init (request, globalValues) {
  log = globalValues.log.getLogger("/map");
  wsConnection = globalValues.wsConnection;

  wsConnection.init(request, 'map', 'utf8', function (message) {
    try {
      messageHandler(message, wsConnection.maps[request.resourceURL.query.user_id], request.resourceURL.query.tag_id);
    } catch (e) {
      console.error(e);
    }
  });
};

function messageHandler (message, connection, selectedTag) {
  connection.floorInfo = JSON.parse(message.utf8Data); // save floorInfo from webpage
  connection.selectedTag = selectedTag; // save selectedTag from webpage
  log.info('floorInfo and selectedTag saved .');
}