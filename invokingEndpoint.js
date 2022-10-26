var Peer = require('simple-peer')
var wrtc = require('wrtc')
const io = require("socket.io-client");
const myId = "IE_" + Date.now();
const role = "INVOKING_ENDPOINT"

var socket = io.connect('ws://localhost:8000', {reconnect: true, query: {"id": myId, "role": role}});
var peers = [];

socket.on('connect', function (s) {
    var test = {
        invokingEndpointId: myId,
        operationId: "007",
        nodesToReach: 1,
        initiatorId: myId,
        initiatorRole: role
    }
    console.log('Invoking Endpoint Connected to Broker');
    console.log('Sending RECRUITMENT_REQUEST')
    socket.emit('RECRUITMENT_REQUEST', test);
});

socket.on('connect_error', function (err) {
    console.log("Broker " + err.message);
});

socket.on('OFFER_NODE', payload => {
    console.log("Received OFFER_NODE from " + payload.answererId)
    const peer = new Peer({ initiator: true, trickle: false, wrtc: wrtc });

    peers.push({
        id: payload.answererId,
        peer: peer
    })

    peer.on("signal", data => {
        console.log("Sending INITIALIZE_CONNECTION to " + payload.answererId)
        payload.signal = data;
        socket.emit("INITIALIZE_CONNECTION", payload)
    })

    peer.on('connect', () => {
        var i = 0;
        setInterval(function(){
            peer.send("[" + i++ + "] Hey " + payload.answererId + " it's me, " + myId + "!")
        }, 2000);
        var n2n = {
            invokingEndpointId: myId,
            operationId: "008",
            nodesToReach: 1,
            initiatorId: payload.answererId,
            initiatorRole: "NODE"
        }
        console.log('Sending RECRUITMENT_REQUEST node to node')
        socket.emit('RECRUITMENT_REQUEST', n2n);
    })
})

socket.on('FINALIZE_CONNECTION', payload => {
    console.log("Received FINALIZE_CONNECTION from " + payload.answererId + ", opening P2P")
    peers.find(p => p.id === payload.answererId).peer.signal(payload.signal)
})

// http://ec2-3-208-18-248.compute-1.amazonaws.com:8000
