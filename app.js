const express = require('express');
var bodyParser = require('body-parser');
var app = new express();
var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var https = require('https');

var config = require('./config');
var log4js = require('log4js');
var tags = [];
var rcoords = {};
var MongoClient = require('./lib/mongoClient');
var RedisClient = require('./lib/redisClient');

/* 全局变量 */
const globalValues = {
  config: config,
  log: log4js,
  tags: tags,
  rcoords: rcoords,
  redisClient: new RedisClient(config.redis, log4js),
  mongoClient: new MongoClient(config.mongodb, log4js, tags, rcoords),
  wsConnection: require('./lib/wsConnection')
};

/* 循环处理数据 */
let CyclicHandle = require('./lib/cyclicHandle');
let cyclicHandle = new CyclicHandle(globalValues);
cyclicHandle.start();

log4js.configure(config.log4js);
var log = log4js.getLogger('startup');

var httpServers = [];
/* httpServer */
var http_server = http.createServer(app);
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

/* http use middleware */
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use('/coord', require('./routes/coord')(globalValues));
app.use('/tag', require('./routes/tag')(globalValues));