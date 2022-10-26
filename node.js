var Peer = require('simple-peer')
var wrtc = require('wrtc')
const { io } = require("socket.io-client");

const myId = "NODE_" + Date.now();
const role = "NODE"

var peers = [];

var brokerSocket = io.connect('ws://localhost:8000', {reconnect: true, query: {"id": myId, "role": role}});

brokerSocket.on('connect', function (s) {
    console.log('Node Connected to Broker!');
});

brokerSocket.on('connect_error', (err) => {
    console.log("Broker " + err.message);
})

brokerSocket.on("RECRUITMENT_BROADCAST", (payload) => {
    console.log("Received RECRUITMENT_BROADCAST from " + payload.invokingEndpointId + " to connect to " + payload.initiatorId)
    console.log("Sending RECRUITMENT_ACCEPT to " + payload.initiatorId)
    payload.answererId = myId;
    brokerSocket.emit("RECRUITMENT_ACCEPT", payload)
})

brokerSocket.on("INCOMING_CONNECTION", (payload) => {
    console.log("Received INCOMING_CONNECTION from " + payload.initiatorId)
    const peer = new Peer({ initiator: false, trickle: false, wrtc: wrtc });
    peers.push({
        id: payload.initiatorId,
        peer: peer
    })

    peer.on("signal", data => {
        console.log("Sending ANSWER_CONNECTION to " + payload.initiatorId)
        payload.signal = data;
        brokerSocket.emit("ANSWER_CONNECTION", payload)
    })

    peer.on('data', data => {
        console.log(data.toString())
    })

    peer.signal(payload.signal);
})

// http://ec2-3-208-18-248.compute-1.amazonaws.com:8000
