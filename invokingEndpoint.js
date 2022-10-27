const RTCPeerConnection = require('wrtc').RTCPeerConnection;
const RTCSessionDescription = require('wrtc').RTCSessionDescription;
const RTCIceCandidate = require('wrtc').RTCIceCandidate;

const io = require("socket.io-client");

const myId = "IE_" + Date.now();
const role = "INVOKING_ENDPOINT"

// const CONNECTION_STRING = 'http://ec2-3-208-18-248.compute-1.amazonaws.com:8000';
const CONNECTION_STRING = 'ws://localhost:8000';

var socket = io.connect(CONNECTION_STRING, {reconnect: true, query: {"id": myId, "role": role}});
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
    const peer = new RTCPeerConnection({
        iceServers: [
            {
                urls: "stun:stun.stunprotocol.org"
            },
            {
                urls: 'turn:numb.viagenie.ca',
                credential: 'muazkh',
                username: 'webrtc@live.com'
            },
        ]
    });

    const testChannel = peer.createDataChannel("test");
    testChannel.onmessage = handleTestChannelMessage(testChannel);

    testChannel.onopen = function(event) {
        var readyState = testChannel.readyState;
        if (readyState == "open") {
            const i = 0;
            console.log("send message " + i)
            testChannel.send(i.toString())
        }
      };

    peer.onicecandidate = handleICECandidateEvent(payload);
    peer.onconnectionstatechange = (event) => {
        console.log(event.type + " " + peer.connectionState)
    };

    peers.push({
        id: payload.answererId,
        peer: peer,
        testChannel: testChannel
    })

    peer.createOffer().then(offer => {
        return peer.setLocalDescription(offer);
    }).then(() => {
        console.log("Sending INITIALIZE_CONNECTION to " + payload.answererId)
        payload.sdp = peer.localDescription
        socket.emit("INITIALIZE_CONNECTION", payload)
    }).catch(e => console.log(e));

})

function handleTestChannelMessage(testChannel){
    return (e) => {
        let value = parseInt(e.data)
        console.log("received " + value++);
        testChannel.send(value.toString())
        /*setInterval(function(){ 
            console.log("send message " + value)
            testChannel.send(value.toString())
        }, 1000);*/
    }
}

function handleICECandidateEvent(payload) {
    return (e) => {
        if (e.candidate) {
            const icePayload = {
                fromId: myId,
                toId: payload.answererId,
                receiverRole: "NODE", 
                candidate: e.candidate
            }
            socket.emit("ICE_CANDIDATE", icePayload);
        }
    }
}

socket.on('FINALIZE_CONNECTION', payload => {
    console.log("Received FINALIZE_CONNECTION from " + payload.answererId + ", opening P2P")
    const desc = new RTCSessionDescription(payload.sdp);
    const peer = peers.find(p => p.id === payload.answererId).peer
    peer.setRemoteDescription(desc).catch(e => console.log(e));
})

socket.on('ICE_CANDIDATE', payload => {
    console.log("Received ICE_CANDIDATE from " + payload.fromId)
    const candidate = new RTCIceCandidate(payload.candidate);
    peers
        .find(p => p.id === payload.fromId)
        .peer
        .addIceCandidate(candidate)
        .catch(e => console.log(e));
})
