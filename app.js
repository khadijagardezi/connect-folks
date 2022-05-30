const express = require("express");
const http = require("http");
const twilio = require("twilio");

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server);

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

app.get("/api/get-turn-credentials", (req, res) => {
  const accountSid = "ACe6a770dd6adef242f8e242abae86d10e";
  const authToken = "6de195570a2fc4242c1b9bad5a41941d";
  const client = twilio(accountSid, authToken);

  client.tokens.create().then((token) => {
    res.send({ token }).catch((err) => {
      console.log(err);
      res.send({ message: "fail turn credicentials", err });
    });
  });
});

let connectedPeers = []; // array
let connectedPeersStrangers = [];

io.on("connection", (socket) => {
  console.log(socket.id);
  connectedPeers.push(socket.id);

  socket.on("pre-offer", (data) => {
    const { calleePersonalCode, callType } = data;
    const connectedPeer = connectedPeers.find(
      (peerSocketId) => peerSocketId === calleePersonalCode
    );

    if (connectedPeer) {
      const data = {
        callerSocketId: socket.id,
        callType,
      };
      io.to(calleePersonalCode).emit("pre-offer", data);
    } else {
      const data = {
        preOfferAnswer: "CALLEE_NOT_FOUND",
      };
      io.to(socket.id).emit("pre-offer-answer", data);
    }
  });

  socket.on("pre-offer-answer", (data) => {
    const { callerSocketId } = data;

    const connectedPeer = connectedPeers.find(
      (peerSocketId) => peerSocketId === callerSocketId
    );

    if (connectedPeer) {
      io.to(data.callerSocketId).emit("pre-offer-answer", data);
    }
  });

  socket.on("webRTC-signaling", (data) => {
    const { connectedUserSocketId } = data;

    const connectedPeer = connectedPeers.find(
      (peerSocketId) => peerSocketId === connectedUserSocketId
    );

    if (connectedPeer) {
      io.to(connectedUserSocketId).emit("webRTC-signaling", data);
    }
  });

  socket.on("user-hanged-up", (data) => {
    const { connectedUserSocketId } = data;

    const connectedPeer = connectedPeers.find(
      (peerSocketId) => peerSocketId === connectedUserSocketId
    );

    if (connectedPeer) {
      io.to(connectedUserSocketId).emit("user-hanged-up");
    }
  });

  socket.on("stranger-connection-status", (data) => {
    const { status } = data;
    if (status) {
      connectedPeersStrangers.push(socket.id);
    } else {
      const newConnectedPeersStrangers = connectedPeersStrangers.filter(
        (peerSocketId) => peerSocketId !== socket.id
      );
      connectedPeersStrangers = newConnectedPeersStrangers;
    }
  });

  socket.on("get-stranger-socket-id", () => {
    let randomStrangerSocketId;
    const filteredConnectedPeersStrangers = connectedPeersStrangers.filter(
      (peerSocketId) => peerSocketId !== socket.id
    );

    if (filteredConnectedPeersStrangers.length > 0) {
      randomStrangerSocketId =
        filteredConnectedPeersStrangers[
          Math.floor(Math.random() * filteredConnectedPeersStrangers.length)
        ];
    } else {
      randomStrangerSocketId = null;
    }

    const data = {
      randomStrangerSocketId,
    };

    io.to(socket.id).emit("stranger-socket-id", data);
  });

  socket.on("disconnect", () => {
    const newConnectedPeers = connectedPeers.filter(
      (peerSocketId) => peerSocketId !== socket.id
    );

    connectedPeers = newConnectedPeers;

    const newConnectedPeersStrangers = connectedPeersStrangers.filter(
      (peerSocketId) => peerSocketId !== socket.id
    );
    connectedPeersStrangers = newConnectedPeersStrangers;
  });
});

// server.listen(PORT, () => {
//   console.log(`listening on ${PORT}`);
// });

server.listen(PORT, () => {
  console.log(`listening on ${PORT}`);
});
