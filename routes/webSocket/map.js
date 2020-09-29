let log;
let wsConnection;
let mongoose = require("mongoose");
let { maternHCPP, predictedRSSI, getNumberInNormalDistribution } = require("../../lib/utils/simulateUtils");

module.exports = function init (request, globalValues) {
  log = globalValues.log.getLogger("/map");
  wsConnection = globalValues.wsConnection;
  wsConnection.init(request, 'map', 'utf8', function (message, connection) {
    log.info(message.utf8Data);
    // let interval;

    /*------------------------------------*/
    // var WebSocketClient = require("websocket").client;
    // const config = require("../../config");
    // const log4js = require("log4js");
    // var tags = [];
    // var rcoords = {};
    // var client = new WebSocketClient();
    // const MongoClient = require("../../lib/mongoClient");
    // const mongoClient = new MongoClient(config.mongodb, log4js, tags, rcoords);

    // client.on("connectFailed", function (error) {
    //   console.log("Connect Error: " + error.toString());
    // });

    // client.on("connect", async (clientConn) => {
    //   console.log("WebSocket Client Connected");
    //   clientConn.on("error", function (error) {
    //     console.log("clientConn Error: " + error.toString());
    //   });
    //   clientConn.on("close", function () {
    //     console.log("echo-protocol clientConn Closed");
    //   });
    //   clientConn.on("message", function (message) {
    //     if (message.type === "utf8") {
    //       console.log("Received: '" + message.utf8Data + "'");
    //     }
    //   });

    //   // 生成随机anchor并存储
    //   // let anchorCount = 100;
    //   // let threshold = 0.4;
    //   // let type = 1;
    //   // let pcoords = maternHCPP(anchorCount,threshold,0,55,0,44,0,type);
    //   // let realCount = pcoords.length;
    //   // let anchorIdHead = "904E9140F0";
    //   //
    //   // await mongoClient.Anchors.deleteMany();
    //   // for(let i = 0; i < realCount; i++){
    //   //   let anchor = {
    //   //     aId: anchorIdHead + (i + 16).toString(16),
    //   //     coords: [...pcoords[i], -38.04, 2.2]
    //   //   };
    //   //   console.log(anchor);
    //   //   await mongoClient.Anchors(anchor).save();
    //   // }
    //   //
    //   let anchors = await mongoClient.Anchors.find();
    //   // console.log(anchors);


    //   // let tags = await mongoClient.Tags.find();
    //   /* [{
    //     "_id" : ObjectId("5e772d336cc5e536ae92b3b9"),
    //     "coords" : [ 0.14, 0.14, -38.04, 2.2 ],
    //     "aId" : "904E9140F915",
    //     "createTime" : ISODate("2020-03-22T09:17:39.239Z"),
    //     "updateTime" : ISODate("2020-06-04T03:22:06.678Z")
    //   }]
    //   */
    //   let tags = {
    //     "10001-04096": {
    //       tId: "10001-04096",
    //       pos: [10, 10],
    //       timestamp: Date.now(),
    //       description: "actual"
    //     },
    //     // "10001-04098": {
    //     //   tId: "10001-04098",
    //     //   pos: [20, 20],
    //     //   timestamp: Date.now(),
    //     //   description: "actual"
    //     // },
    //     // "10001-04097": {
    //     //   tId: "10001-04097",
    //     //   pos: [7, 7],
    //     //   timestamp: Date.now(),
    //     //   description: "actual"
    //     // },
    //     // "10001-04099": {
    //     //   tId: "10001-04099",
    //     //   pos: [7, 7],
    //     //   timestamp: Date.now(),
    //     //   description: "actual"
    //     // },
    //     // "10001-04100": {
    //     //   tId: "10001-04100",
    //     //   pos: [21, 21],
    //     //   timestamp: Date.now(),
    //     //   description: "actual"
    //     // },
    //     // "10211-11111": {
    //     //   tId: "10211-11111",
    //     //   pos: [21, 21],
    //     //   timestamp: Date.now(),
    //     //   description: "actual"
    //     // },
    //     // "22222-22222": {
    //     //   tId: "22222-22222",
    //     //   pos: [21, 21],
    //     //   timestamp: Date.now(),
    //     //   description: "actual"
    //     // },
    //   };

    //   // 马尔科夫链
    //   let vmin = 0.5;
    //   let vmax = 1.0;
    //   let a = Math.random();
    //   let vn = getNumberInNormalDistribution(0.1, 0.2);
    //   let xmin = 0, xmax = 55, ymin = 0, ymax = 44;
    //   let xa = 7, ya = 7;
    //   let sitaa = (0 + 2 * Math.PI) / 2;
    //   let va = (vmin + vmax) / 2;
    //   let t = 1;
    //   let vmean = (vmin + vmax) / 2;
    //   let sitamean = (0 + 2 * Math.PI) / 2;

    //   // Random Direction Model
    //   const max_x = 55;
    //   const max_y = 44;
    //   const v1 = 0.5;
    //   const v2 = 1;
    //   let start_x = Math.random() * max_x;
    //   let start_y = Math.random() * max_y;
    //   let angle = Math.random() * 2 * Math.PI;

    //   interval = setInterval(() => {

    //     // 测试按照方形路线运动 speed = 1m/s
    //     // if(tags["10001-04097"].pos[1] == 7) tags["10001-04097"].pos[0] += 1;
    //     // if(tags["10001-04097"].pos[0] == 42) tags["10001-04097"].pos[1] += 1;
    //     // if(tags["10001-04097"].pos[1] == 42) tags["10001-04097"].pos[0] -= 1;
    //     // if(tags["10001-04097"].pos[0] == 7) tags["10001-04097"].pos[1] -= 1;

    //     // // // 测试按照方形路线运动 speed = 0.5m/s
    //     // if(tags["10001-04099"].pos[1] == 7) tags["10001-04099"].pos[0] += 0.5;
    //     // if(tags["10001-04099"].pos[0] == 35) tags["10001-04099"].pos[1] += 0.5;
    //     // if(tags["10001-04099"].pos[1] == 35) tags["10001-04099"].pos[0] -= 0.5;
    //     // if(tags["10001-04099"].pos[0] == 7) tags["10001-04099"].pos[1] -= 0.5;

    //     // // 测试随机运动路线s
    //     // tags["10001-04100"].pos[0] += Math.random() * 6 - 3;
    //     // tags["10001-04100"].pos[1] += Math.random() * 6 - 3;
    //     // if (tags["10001-04100"].pos[0] < 0) tags["10001-04100"].pos[0] = 0;
    //     // if (tags["10001-04100"].pos[0] > 55) tags["10001-04100"].pos[0] = 55;
    //     // if (tags["10001-04100"].pos[1] < 0) tags["10001-04100"].pos[1] = 0;
    //     // if (tags["10001-04100"].pos[1] > 44) tags["10001-04100"].pos[1] = 44;

    //     // // 测试马尔科夫链移动
    //     // tags["10211-11111"].pos[0] = xa;
    //     // tags["10211-11111"].pos[1] = ya;
    //     // let sitan = getNumberInNormalDistribution(Math.PI, 0.2);
    //     // let sitab = a * sitaa + (1 - a) * sitamean + Math.sqrt((1 - a ^ 2)) * sitan;
    //     // let vb = a * va + (1 - a) * vmean// + Math.sqrt((1 - a ^ 2)) * vn;
    //     // let xb = xa + va * Math.cos(sitab) * t;
    //     // let yb = ya + va * Math.sin(sitab) * t;

    //     // if (xb < xmin)
    //     //     xb = xb + xmax;
    //     // else if (xb > xmax)
    //     //     xb = xb - xmax;
    //     // else if (yb < ymin)
    //     //     yb = yb + ymax;
    //     // else if (yb > ymax)
    //     //     yb = yb - ymax;

    //     // xa = xb;
    //     // ya = yb;
    //     // va = vb;
    //     // sitaa = sitab;

    //     // // Random Direction Model
    //     // tags["22222-22222"].pos[0] = start_x;
    //     // tags["22222-22222"].pos[1] = start_y;
    //     // let temp_x = start_x + (Math.random() * v2 + v1) * t * Math.sin(angle);
    //     // let temp_y = start_y + (Math.random() * v2 + v1) * t * Math.cos(angle);
    //     // while(temp_x > max_x || temp_x <= 0 || temp_y > max_y || temp_y <= 0) {
    //     //   angle = Math.random() * 2 * Math.PI;
    //     //   temp_x = start_x + (Math.random() * v2 + v1) * t * Math.sin(angle);
    //     //   temp_y = start_y + (Math.random() * v2 + v1) * t * Math.cos(angle);
    //     // }
    //     // start_x = temp_x;
    //     // start_y = temp_y;s

    //     Object.keys(tags).forEach((key)=>{
    //       // 发送到网页
    //       connection.sendUTF(JSON.stringify(tags[key]));
    //     });

    //     anchors.forEach(anchor => {
    //       let json = {
    //         aId: anchor.aId,
    //         tags: [],
    //         timestamp: Date.now()
    //       };

    //       Object.keys(tags).forEach((key)=>{
    //         let tag = tags[key];

    //         let dis = Math.sqrt(Math.pow(tag.pos[0] - anchor.coords[0], 2) + Math.pow(tag.pos[1] - anchor.coords[1], 2));
    //         pr = predictedRSSI(dis);
    //         let head = Math.abs(Math.round(pr)).toString(16);
    //         let arr = tag.tId.split("-");
    //         let major = (+arr[0]).toString(16);
    //         let minor = (+arr[1]).toString(16);

    //         let str = head + "FDA50693A4E24FB1AFCFC6EB07647825" + major + minor;
    //         json.tags.push(str);
    //         // log.error(`tag: ${key}, anchor: ${anchor.aId}`);
    //       });
    //       // console.log(JSON.stringify(json));
    //       // 发送到服务器
    //       clientConn.sendUTF(JSON.stringify(json));
    //     });
    //   }, 1000);

    // });

    // client.connect(
    //   "ws://127.0.0.1:3004/root?user_id=xuke&client_type=root",
    //   "echo-protocol"
    // );
    /*------------------------------------*/
    connection.on('close', function (reasonCode, description) {
      // clearInterval(interval);
      // disconnect(client_type, query.user_id);
      log.info('Peer ' + connection.remoteAddress + ' disconnected.');
    });
  });
};
