var WebSocketClient = require("websocket").client;
const config = require("../config");
const log4js = require("log4js");
var tags = [];
var rcoords = {};
var client = new WebSocketClient();
const MongoClient = require("../lib/mongoClient");
const mongoClient = new MongoClient(config.mongodb, log4js, tags, rcoords);

client.on("connectFailed", function (error) {
  console.log("Connect Error: " + error.toString());
});

client.on("connect", function (connection) {
  console.log("WebSocket Client Connected");
  connection.on("error", function (error) {
    console.log("Connection Error: " + error.toString());
  });
  connection.on("close", function () {
    console.log("echo-protocol Connection Closed");
  });
  connection.on("message", function (message) {
    if (message.type === "utf8") {
      console.log("Received: '" + message.utf8Data + "'");
    }
  });

  const aIdArr = [
    "904E9140F915",
    "904E9140F916",
    "904E9140F917",
    "904E9140F918",
    "904E9140F919",
    "904E9140F91A",
    "904E9140F91B",
    "904E9140F91C",
    "904E9140F91D",
  ];

  // const tIdArr = [
  //   "10001-04096",
  //   "10001-04097",
  //   "10001-04098",
  //   "11111-12310",
  //   "11110-11113",
  //   "10211-11111",
  //   "22222-22222",
  // ];

  const uniform2NormalDistribution = () => {
    var sum = 0.0;
    for (var i = 0; i < 12; i++) {
      sum = sum + Math.random();
    }
    return sum - 6.0;
  };

  const getNumberInNormalDistribution = (mean, sigma) => mean + (uniform2NormalDistribution() * sigma);

  const predictedRSSI = (DistanceMsr) => {
    if (DistanceMsr == 0) return 0;
    let LightSpeedC = 3e8;
    let BlueTooth = 2400 * 1000000;
    let Zigbee = 915.0e6;
    let Freq = BlueTooth;
    let TXAntennaGain = 1;
    let RXAntennaGain = 1;
    let Dref = 1;
    let PTx = 0.001;
    let Lp;
    if (DistanceMsr <= 1.2) Lp = 1;
    else if (DistanceMsr <= 6.5) Lp = Math.exp((1.2 - DistanceMsr) / 4.7);
    else Lp = Math.exp((6.5 - DistanceMsr) / 32.6) * 0.32;

    let sigma = 6;
    let PathLossExponent;
    let rand = Math.random();
    if (Lp > rand) {
      sigma = 3;
      PathLossExponent = 2.2;
    } else {
      sigma = 8.03;
      PathLossExponent = 2.8;
    }
    let mean = 0;
    let Wavelength = LightSpeedC / Freq;
    let PTxdBm = 10 * Math.log(PTx * 1000) / Math.log(10);
    let M = Wavelength / (4 * Math.PI * Dref);
    let Pr0 = PTxdBm + TXAntennaGain + RXAntennaGain - (20 * Math.log(1 / M) / Math.log(10));
    let GaussRandom = getNumberInNormalDistribution(mean, sigma);
    return Pr0 - (10 * PathLossExponent * Math.log(DistanceMsr / Dref) / Math.log(10)) + GaussRandom;
  };

  // const head = (aId) => {

  //   return (60 + Math.ceil(Math.random() * 10)).toString(16);
  // };

  // const tail = (tIdArr, n) => {
  //   let arr = tIdArr[n].split("-");
  //   return {
  //     major: (+arr[0]).toString(16),
  //     minor: (+arr[1]).toString(16)
  //   };
  // };

  // const generate = (aId, n) => {
  //   let json = {
  //     aId: aId,
  //     tags: [],
  //     timestamp: Date.now()
  //   };
  //   for (let j = 0; j < n; j++) {
  //     // let str = head() + "FDA50693A4E24FB1AFCFC6EB076478252711" + tail[j];
  //     let str = head(aId) + "FDA50693A4E24FB1AFCFC6EB07647825" + tail(tIdArr, j).major + tail(tIdArr, j).minor;
  //     // console.log(str);
  //     json.tags.push(str);
  //   }
  //   return json;
  // };

  // const cyclicSend = (n) => {
  //   for (let i in aIdArr) {
  //     (function (i) {
  //       setTimeout(function () {
  //         // console.log(generate(aIdArr[i]));
  //         connection.sendUTF(JSON.stringify(generate(aIdArr[i], n)));
  //         // console.log(generate(aIdArr[i], n));
  //       }, i * 10);
  //     })(i);
  //   }
  // };


  let timer = 0;

  mongoClient.Anchors.find().then(anchors => {
    /* [{
      "_id" : ObjectId("5e772d336cc5e536ae92b3b9"),
      "coords" : [ 0.14, 0.14, -38.04, 2.2 ],
      "aId" : "904E9140F915",
      "createTime" : ISODate("2020-03-22T09:17:39.239Z"),
      "updateTime" : ISODate("2020-06-04T03:22:06.678Z")
    }]
    */
    let tag = { tId: "10001-04096", x: 7, y: 7 };


    setInterval(() => {
      anchors.forEach(anchor => {
        let dis = Math.sqrt(Math.pow(tag.x - anchor.coords[0], 2) + Math.pow(tag.y - anchor.coords[1], 2));
        pr = predictedRSSI(dis);
        let head = Math.abs(Math.round(pr)).toString(16);
        let arr = tag.tId.split("-");
        let major = (+arr[0]).toString(16);
        let minor = (+arr[1]).toString(16);

        let json = {
          aId: anchor.aId,
          tags: [],
          timestamp: Date.now()
        };
        let str = head + "FDA50693A4E24FB1AFCFC6EB07647825" + major + minor;
        json.tags.push(str);
        // console.log(JSON.stringify(json));
        connection.sendUTF(JSON.stringify(json));
        console.log(`send! timer=${timer}`);
      });

      timer = timer + 1;
    }, 1000);
  });

});

client.connect(
  "ws://127.0.0.1:3004/root?user_id=xuke&client_type=root",
  "echo-protocol"
);
