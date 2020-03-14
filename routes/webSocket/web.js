var log;
var wsConnection;

module.exports = function init (request, globalValues) {
  log = globalValues.log.getLogger("/web");
  wsConnection = globalValues.wsConnection;

  wsConnection.init(request, 'web', 'utf8', function (message, connection) {
    log.info('---')
    connection.sendUTF('success');
    const mongoClient = globalValues.mongoClient;

    mongoClient.Tags.watch().on('change', change => {
      mongoClient.Tags
      .find()
      .populate({ path: "user", select: 'username' })
      .then((tags) => {
        let result = { type: 'tags', data: tags };
        connection.sendUTF(JSON.stringify(result));
      })
    });

    mongoClient.User.watch().on('change', change => {
      mongoClient.User
      .find()
      .populate({ path: "tags" })
      .then((users) => {
        let result = { type: 'users', data: users };
        connection.sendUTF(JSON.stringify(result));
      })
    });
    // try {
    //   messageHandler(message, wsConnection.maps[request.resourceURL.query.user_id]);
    // } catch (e) {
    //   console.error(e);
    // }
  });
};

function messageHandler (message, connection) {
  try {
    connection.floorInfo = JSON.parse(message.utf8Data); // save floorInfo from webpage
    log.trace('floorInfo saved.');
  } catch (err) {
    log.trace('floorInfo wrong.');
  }
}
