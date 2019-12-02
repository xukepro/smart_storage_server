var WebSocketServer = require('websocket').server;
var WebSocketRouter = require('websocket').router;
var http = require('http');
var https = require('https');

var config = require('./config');
var wsConnection = require('./lib/wsConnection');

var http_server = http.createServer(function (request, response) {
  console.log((new Date()) + ' HTTP Received request for ' + request.url);
  response.writeHead(404);
  response.end();
});
http_server.listen(config.http_port, function () {
  console.log((new Date()) + ' HTTP Server is listening on port ' + config.http_port);
});

var wssServer = null;
if ('sec' in config) {
  let options = { key: config.sec.key, cert: config.sec.crt };
  var https_server = https.createServer(options, function (request, response) {
    console.log((new Date()) + ' HTTPS Received request for ' + request.url);
    response.writeHead(404);
    response.end();
  });
  https_server.listen(config.https_port, function () {
    console.log((new Date()) + ' HTTPS Server is listening on port ' + config.https_port);
  });

  wssServer = new WebSocketServer({
    httpServer: [http_server, https_server],
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
  });
} else {
  wssServer = new WebSocketServer({
    httpServer: http_server,
    autoAcceptConnections: false
  });
}

var router = new WebSocketRouter();
router.attachServer(wssServer);

router.mount('/app', 'echo-protocol', request => require('./routes/app')(request, wsConnection));
router.mount('/root', 'echo-protocol', request => require('./routes/root')(request, wsConnection));
router.mount('/map', 'echo-protocol', request => require('./routes/map')(request, wsConnection));