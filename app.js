const express = require("express");
var bodyParser = require("body-parser");
var app = new express();
var WebSocketServer = require("websocket").server;
var WebSocketRouter = require("websocket").router;
var http = require("http");
var https = require("https");

var config = require("./config");
var log4js = require("log4js");
var tags = [];
var anchors = {};
var MongoClient = require("./lib/mongoClient");
var RedisClient = require("./lib/redisClient");

/* 全局变量 */
const globalValues = {
  config: config,
  log: log4js,
  tags: tags,
  anchors: anchors,
  redisClient: new RedisClient(config.redis, log4js),
  mongoClient: new MongoClient(config.mongodb, log4js, tags, anchors),
  wsConnection: require("./lib/wsConnection")
};

/* 循环处理数据 */
let CyclicHandle = require("./lib/cyclicHandle");
let cyclicHandle = new CyclicHandle(globalValues);
cyclicHandle.start();

log4js.configure(config.log4js);
var log = log4js.getLogger("startup");

var httpServers = [];
/* httpServer */
var http_server = http.createServer(app);
http_server.listen(config.http_port, function () {
  log.info("HTTP Server is listening on port " + config.http_port);
});
httpServers.push(http_server);

/* httpServers */
if (
  Object.prototype.hasOwnProperty.call(config, "https_port") &&
  Object.prototype.hasOwnProperty.call(config, "sec")
) {
  let options = { key: config.sec.key, cert: config.sec.crt };
  var https_server = https.createServer(options, function (request, response) {
    log.info("HTTPS Received request for " + request.url);
    response.writeHead(404);
    response.end();
  });
  https_server.listen(config.https_port, function () {
    log.info("HTTPS Server is listening on port " + config.https_port);
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

router.mount("/app", "echo-protocol", (request) =>
  require("./routes/webSocket/app")(request, globalValues)
);
router.mount("/root", "echo-protocol", (request) =>
  require("./routes/webSocket/root")(request, globalValues)
);
router.mount("/map", "echo-protocol", (request) =>
  require("./routes/webSocket/map")(request, globalValues)
);

let userAuth = require('./middleware/auth')(globalValues.mongoClient.User, 'admin');
let adminAuth = require('./middleware/auth')(globalValues.mongoClient.AdminUser, 'user');

/* http use middleware */
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.set("secret", "as;jdhwiebfkjxcvxzcla;wetn;ahre;oq3jkvas");

app.use("/admin/login", require("./routes/admin/login")(globalValues));
app.use("/admin/coord", require("./routes/admin/anchor")(globalValues));
app.use("/admin/user", require("./routes/admin/user")(globalValues));
app.use("/admin/tag", require("./routes/user/tag")(globalValues).AdminRouter);

app.use("/register", require("./routes/user/register")(globalValues));
app.use("/login", require("./routes/user/login")(globalValues));
app.use("/tag", require("./routes/user/tag")(globalValues).UserRouter);

// app.use("/admin/login", require("./routes/admin/login")(globalValues));
// app.use("/admin/coord", adminAuth, require("./routes/admin/anchor")(globalValues));
// app.use("/admin/user", adminAuth, require("./routes/admin/user")(globalValues));
// app.use("/admin/tag", adminAuth, require("./routes/user/tag")(globalValues).AdminRouter);

// app.use("/register", require("./routes/user/register")(globalValues));
// app.use("/login", require("./routes/user/login")(globalValues));
// app.use("/tag", userAuth, require("./routes/user/tag")(globalValues).UserRouter);

app.use((err, req, res, next) => {
  let error = err.status || 500;
  let code = err.code;
  let message = err.message;
  if (code === 11000) {
    message = "duplicate key error";
  }
  res.status(error).send({ code, message });
});
