var Peer = require('simple-peer')
var wrtc = require('wrtc')
const { io } = require("socket.io-client");

const myId = "NODE_" + Date.now();
const role = "NODE"

var IEpeers = [];
var nodePeers = [];

var brokerSocket = io.connect('ws://localhost:8000', {reconnect: true, query: {"id": myId, "role": role}});

brokerSocket.on('connect', function (s) {
    console.log('Node Connected to Broker!');
});

brokerSocket.on('connect_error', (err) => {
    console.log("Broker " + err.message);
})

brokerSocket.on("RECRUITMENT_BROADCAST", (payload) => {
    console.log("Received RECRUITMENT_BROADCAST from " + payload.invokingEndpointId + " to connect to " + payload.initiatorId)
    if(IEpeers.find(p => p.id === payload.initiatorId) === undefined){
        console.log("Sending RECRUITMENT_ACCEPT to " + payload.initiatorId)
        payload.answererId = myId;
        brokerSocket.emit("RECRUITMENT_ACCEPT", payload);
    }
})

brokerSocket.on("INCOMING_CONNECTION", (payload) => {
    console.log("Received INCOMING_CONNECTION from " + payload.initiatorId)
    const peer = new Peer({ initiator: false, trickle: false, wrtc: wrtc });
    if(payload.role === "NODE"){
        nodePeers.push({
            id: payload.initiatorId,
            peer: peer
        })
    } else {
        IEpeers.push({
            id: payload.initiatorId,
            peer: peer
        })
    }

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

brokerSocket.on('OFFER_NODE', payload => {
    console.log("Received OFFER_NODE from " + payload.answererId)
    const peer = new Peer({ initiator: true, trickle: false, wrtc: wrtc });

    nodePeers.push({
        id: payload.answererId,
        peer: peer
    })

    peer.on("signal", data => {
        console.log("Sending INITIALIZE_CONNECTION to " + payload.answererId)
        payload.signal = data;
        brokerSocket.emit("INITIALIZE_CONNECTION", payload)
    })

    peer.on('connect', () => {
        var i = 0;
        setInterval(function(){
            peer.send("[" + i++ + "] Hey this is a node to node connection")
        }, 2000);
    })
})

brokerSocket.on('FINALIZE_CONNECTION', payload => {
    console.log("Received FINALIZE_CONNECTION from " + payload.answererId + ", opening P2P")
    nodePeers.find(p => p.id === payload.answererId).peer.signal(payload.signal)
})

// http://ec2-3-208-18-248.compute-1.amazonaws.com:8000
