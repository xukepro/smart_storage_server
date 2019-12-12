var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var https = require('https');

var config = require('./config');
var log4js = require('log4js');
log4js.configure(config.log4js);
var log = log4js.getLogger('startup');

// var wsConnection = require('./lib/wsConnection');
// var RedisClient = require('./lib/redisClient');
// var mongoClient = require('./lib/mongoClient');

var httpServers = [];

const globalValues = {
  config: config,
  wsConnection: require('./lib/wsConnection'),
  redisClient: require('./lib/redisClient'),
  mongoClient: require('./lib/mongoClient'),
  log: log4js,
  rcoords: {}
};

globalValues.mongoClient.getCoords().then(res => {
  for (let row of res) {
    globalValues.rcoords[row._id] = row.coords;
  }
});

var http_server = http.createServer(function (request, response) {
  log.info('HTTP Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
http_server.listen(config.http_port, function () {
  log.info('HTTP Server is listening on port ' + config.http_port);
});
httpServers.push(http_server);

if (Object.prototype.hasOwnProperty.call(config, 'https_port')
  && Object.prototype.hasOwnProperty.call(config, 'sec')) {
  let options = { key: config.sec.key, cert: config.sec.crt };
  var https_server = https.createServer(options, function (request, response) {
    log.info('HTTPS Received request for ' + request.url);
    response.writeHead(404);
    response.end();
  });
  https_server.listen(config.https_port, function () {
    log.info('HTTPS Server is listening on port ' + config.https_port);
  });
  httpServers.push(https_server);
}

var wssServer = new WebSocketServer({
  httpServer: httpServers,
  autoAcceptConnections: false
});

var router = new WebSocketRouter();
router.attachServer(wssServer);

router.mount('/app', 'echo-protocol', request => require('./routes/app')(request, globalValues));
router.mount('/root', 'echo-protocol', request => require('./routes/root')(request, globalValues));
router.mount('/map', 'echo-protocol', request => require('./routes/map')(request, globalValues));

require('./lib/cyclicHandle')(globalValues);
