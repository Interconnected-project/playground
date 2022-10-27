const RTCPeerConnection = require('wrtc').RTCPeerConnection;
const RTCSessionDescription = require('wrtc').RTCSessionDescription;
const RTCIceCandidate = require('wrtc').RTCIceCandidate;

const { io } = require("socket.io-client");

const myId = "NODE_" + Date.now();
const role = "NODE"

var IEpeers = [];
var nodePeers = [];

const CONNECTION_STRING = 'http://ec2-3-208-18-248.compute-1.amazonaws.com:8000';
// const CONNECTION_STRING = 'ws://localhost:8000';

var brokerSocket = io.connect(CONNECTION_STRING, {reconnect: true, query: {"id": myId, "role": role}});

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

    peer.ondatachannel = (event) => {
        console.log("ondatachannel")
        console.log(event)
        const testChannel = event.channel;
        testChannel.onmessage = (e) => {
            let value = parseInt(e.data);
            console.log("received " + value++);
            testChannel.send(value.toString())
        }
    }

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

    peer.onicecandidate = handleICECandidateEvent(payload);
    peer.onconnectionstatechange = (event) => {
        console.log(event.type + " " + peer.connectionState)
    };

    const desc = new RTCSessionDescription(payload.sdp);
    peer.setRemoteDescription(desc).then(() => {
        return peer.createAnswer();
    }).then(answer => {
        return peer.setLocalDescription(answer);
    }).then(() => {
        console.log("Sending ANSWER_CONNECTION to " + payload.initiatorId)
        payload.sdp = peer.localDescription;
        brokerSocket.emit("ANSWER_CONNECTION", payload)
    })
})

function handleICECandidateEvent(payload) {
    return (e) => {
        if (e.candidate) {
            const icePayload = {
                fromId: myId,
                senderRole: role,
                toId: payload.initiatorId,
                receiverRole: payload.initiatorRole, 
                candidate: e.candidate
            }
            brokerSocket.emit("ICE_CANDIDATE", icePayload);
        }
    }
}

brokerSocket.on('ICE_CANDIDATE', payload => {
    console.log("Received ICE_CANDIDATE from " + payload.fromId)
    const candidate = new RTCIceCandidate(payload.candidate);
    IEpeers
        .find(p => p.id === payload.fromId)
        .peer
        .addIceCandidate(candidate)
        .catch(e => console.log(e));
})
