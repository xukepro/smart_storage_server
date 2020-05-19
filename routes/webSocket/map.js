let log;
let wsConnection;
let mongoose = require("mongoose");

module.exports = function init (request, globalValues) {
  log = globalValues.log.getLogger("/map");
  wsConnection = globalValues.wsConnection;
  wsConnection.init(request, 'map', 'utf8', function (message, connection) {
    log.info(message.utf8Data);
    // log.info(wsConnection.maps);
    // connection.sendUTF('success');
    const mongoClient = globalValues.mongoClient;
    let interval;
    let data = {};
    let userId = request.resourceURL.query.user_id;
    let level = request.resourceURL.query.level;
    let user = mongoose.Types.ObjectId(userId);
    log.info("map connections count: " + Object.keys(wsConnection.maps).length)

    let getTags = level === 'admin' ? mongoClient.Tags.find() : mongoClient.Tags.find({ user });
    getTags.then((tags) => {
      // console.log(tags)
      interval = setInterval(() => {
        tags.forEach((item) => {
          if (!data[item.tId]) {
            data[item.tId] = {
              tId: item.tId,
              pos: [Math.random() * 55, Math.random() * 44],
              timestamp: Date.now(),
            }
          } else {
            data[item.tId].pos[0] += Math.random() * 10 - 5;
            data[item.tId].pos[1] += Math.random() * 10 - 5;
            if (data[item.tId].pos[0] < 0) data[item.tId].pos[0] = 0;
            if (data[item.tId].pos[0] > 55) data[item.tId].pos[0] = 55;
            if (data[item.tId].pos[1] < 0) data[item.tId].pos[1] = 0;
            if (data[item.tId].pos[1] > 44) data[item.tId].pos[1] = 44;
          }
          connection.sendUTF(JSON.stringify(data[item.tId]));
        })
      }, 1000);
      // singleData = {
      //   tId: '10001-10001',
      //   pos: [ 46.563476, -10.510793 ],
      //   timestamp: 1589861522.215
      // }
    })

    connection.on('close', function (reasonCode, description) {
      clearInterval(interval);
      // disconnect(client_type, query.user_id);
      log.info('Peer ' + connection.remoteAddress + ' disconnected.');
    });
  });
};
