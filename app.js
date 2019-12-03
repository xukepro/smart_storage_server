var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var https = require('https');

var config = require('./config');
var wsConnection = require('./lib/wsConnection');

var httpServers = [];

var http_server = http.createServer(function (request, response) {
  console.log((new Date()) + ' HTTP Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
http_server.listen(config.http_port, function () {
  console.log((new Date()) + ' HTTP Server is listening on port ' + config.http_port);
});
httpServers.push(http_server);

if (('https_port' in config) && ('sec' in config)) {
  let options = { key: config.sec.key, cert: config.sec.crt };
  var https_server = https.createServer(options, function (request, response) {
    console.log((new Date()) + ' HTTPS Received request for ' + request.url);
    response.writeHead(404);
    response.end();
  });
  https_server.listen(config.https_port, function () {
    console.log((new Date()) + ' HTTPS Server is listening on port ' + config.https_port);
  });
  httpServers.push(https_server);
}

var wssServer = new WebSocketServer({
  httpServer: httpServers,
  autoAcceptConnections: false
});

var router = new WebSocketRouter();
router.attachServer(wssServer);

router.mount('/app', 'echo-protocol', request => require('./routes/app')(request, wsConnection));
router.mount('/root', 'echo-protocol', request => require('./routes/root')(request, wsConnection));
router.mount('/map', 'echo-protocol', request => require('./routes/map')(request, wsConnection));