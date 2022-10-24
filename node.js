var Peer = require('simple-peer')
var wrtc = require('wrtc')
const { io } = require("socket.io-client");

const myId = "NODE_" + Date.now();
const role = "NODE"

var peers = [];

var brokerSocket = io.connect('http://ec2-3-208-18-248.compute-1.amazonaws.com:8000', {reconnect: true, query: {"id": myId, "role": role}});

brokerSocket.on('connect', function (s) {
    console.log('Node Connected to Broker!');
});

brokerSocket.on('connect_error', (err) => {
    console.log("Broker " + err.message);
})

brokerSocket.on("RECRUITMENT_BROADCAST", (payload) => {
    console.log("Received RECRUITMENT_BROADCAST from " + payload.invokingEndpointId)
    console.log("Sending RECRUITMENT_ACCEPT to " + payload.invokingEndpointId)
    brokerSocket.emit("RECRUITMENT_ACCEPT", {
        invokingEndpointId: payload.invokingEndpointId,
        operationId: payload.operationId,
        nodeId: myId
    })
})

brokerSocket.on("INCOMING_CONNECTION", (payload) => {
    console.log("Received INCOMING_CONNECTION from " + payload.invokingEndpointId)
    const peer = new Peer({ initiator: false, trickle: false, wrtc: wrtc });
    peers.push({
        id: payload.invokingEndpointId,
        peer: peer
    })

    peer.on("signal", data => {
        console.log("Sending ANSWER_CONNECTION to " + payload.invokingEndpointId)
        payload.signal = data;
        brokerSocket.emit("ANSWER_CONNECTION", payload)
    })

    peer.on('data', data => {
        console.log(data.toString())
    })

    peer.signal(payload.signal);
})

// ws://localhost:8000
