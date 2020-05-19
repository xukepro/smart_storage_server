var WebSocketClient = require("websocket").client;

var client = new WebSocketClient();

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
  ];

  const tIdArr = [
    "10001-04096",
    "10001-04097",
    "10001-04098",
    "11111-12310",
    "11110-11113",
    "10211-11111",
    "22222-22222",
  ];

  // const tIdArr = (n) => {
  //   return [...new Array(n).keys()].map((k) => (k + 4096).toString(16));
  // };

  // arr.sort(() => 0.5 - Math.random());
  const head = () => {
    return (60 + Math.ceil(Math.random() * 10)).toString(16);
  };

  const tail = (tIdArr, n) => {
    let arr = tIdArr[n].split("-");
    return {
      major: (+arr[0]).toString(16),
      minor: (+arr[1]).toString(16)
    };
  };

  const generate = (aId, n) => {
    let json = {
      aId: aId,
      tags: [],
      timestamp: Date.now()
    };
    for (let j = 0; j < n; j++) {
      // let str = head() + "FDA50693A4E24FB1AFCFC6EB076478252711" + tail[j];
      let str = head() + "FDA50693A4E24FB1AFCFC6EB07647825" + tail(tIdArr, j).major + tail(tIdArr, j).minor;
      // console.log(str);
      json.tags.push(str);
    }
    return json;
  };

  const cyclicSend = (n) => {
    for (let i in aIdArr) {
      (function (i) {
        setTimeout(function () {
          // console.log(generate(aIdArr[i]));
          connection.sendUTF(JSON.stringify(generate(aIdArr[i], n)));
          // console.log(generate(aIdArr[i], n));
        }, i * 10);
      })(i);
    }
  };

  let n = tIdArr.length;
  let timer = 0;
  let timerLimit = 1;
  let N = 5;
  setInterval(() => {
    // if (timer < timerLimit && n < N) {
      cyclicSend(n);
      console.log(`send! n=${n},timer=${timer}`);
      timer = timer + 1;
    // } else if (timer === timerLimit) {
      // n = n + 500;
      // timer = 0;
    // }
  }, 1000);
  // let s =
  //   "12110A904E9140F9190000016EF943AE6154FDA50693A4E24FB1AFCFC6EB07647825271102A641B5B182C7EAB14988AA99B5C1517008D90001A53544B5B182C7EAB14988AA99B5C1517008D90001E17352B5B182C7EAB14988AA99B5C1517008D9000103025311223344556677889988776655443322000B000B3CB5B182C7EAB14988AA99B5C1517008D900011E8944FDA50693A4E24FB1AFCFC6EB07647825271101AE47B5B182C7EAB14988AA99B5C1517008D90001DF2B37FDA50693A4E24FB1AFCFC6EB07647825271101F6620112233445566778899AABBCCDDEEFF000010002";
  // let b = Buffer.from(s, "hex");
  // connection.send(b);
});

client.connect(
  "ws://127.0.0.1:3004/root?user_id=xuke&client_type=root",
  "echo-protocol"
);
