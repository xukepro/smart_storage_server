var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var https = require('https');

var config = require('./config');
var log4js = require('log4js');
log4js.configure(config.log4js);

var httpServers = [];

var log = log4js.getLogger('startup');

var MongoClient = require('./lib/mongoClient');
var RedisClient = require('./lib/redisClient');

/* 全局变量 */
const globalValues = {
  config: config,
  log: log4js,
  wsConnection: require('./lib/wsConnection'),
  redisClient: new RedisClient(config.redis, log4js),
  mongoClient: new MongoClient(config.mongodb, log4js),
  rcoords: {}
};

/* 给全局变量的rcoods赋值 */
globalValues.mongoClient.getCoords().then(res => {
  for (let row of res) {
    globalValues.rcoords[row._id] = row.coords;
  }
});

/* 循环处理数据 */
let CyclicHandle = require('./lib/cyclicHandle');
let cyclicHandle = new CyclicHandle(globalValues);
cyclicHandle.start();

/* httpServer */
var http_server = http.createServer(function (request, response) {
  log.info('HTTP Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
http_server.listen(config.http_port, function () {
  log.info('HTTP Server is listening on port ' + config.http_port);
});
httpServers.push(http_server);

/* httpServers */
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

/* wssServer */
var wssServer = new WebSocketServer({
  httpServer: httpServers,
  autoAcceptConnections: false
});

var router = new WebSocketRouter();
router.attachServer(wssServer);

router.mount('/app', 'echo-protocol', request => require('./routes/app')(request, globalValues));
router.mount('/root', 'echo-protocol', request => require('./routes/root')(request, globalValues));
router.mount('/map', 'echo-protocol', request => require('./routes/map')(request, globalValues));