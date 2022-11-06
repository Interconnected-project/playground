const RTCPeerConnection = require('wrtc').RTCPeerConnection;
const RTCSessionDescription = require('wrtc').RTCSessionDescription;
const RTCIceCandidate = require('wrtc').RTCIceCandidate;

const io = require("socket.io-client");

const myId = "IE_" + Date.now();
const role = "INVOKING_ENDPOINT"
const OPERATION_ID = "007";

const CONNECTION_STRING = 'http://ec2-3-208-18-248.compute-1.amazonaws.com:8000';
// const CONNECTION_STRING = 'ws://localhost:8000';

var socket = io.connect(CONNECTION_STRING, {reconnect: true, query: {"id": myId, "role": role}});
var peers = [];

socket.on('connect', function (s) {
    var test = {
        operationId: OPERATION_ID,
        nodesToReach: 1,
        masterId: myId,
        masterRole: role
    }
    console.log('Invoking Endpoint Connected to Broker');
    console.log('Sending RECRUITMENT_REQUEST')
    socket.emit('RECRUITMENT_REQUEST', test);
});

socket.on('connect_error', function (err) {
    console.log("Broker " + err.message);
});

socket.on('RECRUITMENT_ACCEPT', payload => {
    console.log("Received RECRUITMENT_ACCEPT from " + payload.slaveId)
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
            /*const i = 0;
            console.log("send message " + i)
            testChannel.send(i.toString())*/
            
            testChannel.send(JSON.stringify({
                channel: 'START_JOB',
                payload: {
                    name: 'MAPREDUCE_MASTER',
                    params: {
                        mapWorkers: 2,
                        reduceWorkers: 1,
                        mapFunction : "(s) => { return [s.length, s] }",
                        reduceFunction : "console.log(\"reduce function\")",
                    }
                }
            }))
        }
      };

    peer.onicecandidate = handleICECandidateEvent(payload);
    peer.onconnectionstatechange = (event) => {
        console.log(event.type + " " + peer.connectionState)
    };

    peers.push({
        id: payload.slaveId,
        peer: peer,
        testChannel: testChannel
    })

    peer.createOffer().then(offer => {
        return peer.setLocalDescription(offer);
    }).then(() => {
        console.log("Sending REQUEST_CONNECTION to " + payload.slaveId)
        payload.sdp = peer.localDescription
        socket.emit("REQUEST_CONNECTION", payload)
    }).catch(e => console.log(e));

})

function handleTestChannelMessage(testChannel){
    return (e) => {
        const parsedMsg = JSON.parse(e.data)
        console.log(parsedMsg)
        switch(parsedMsg.channel){
            case "START_JOB": {
                if(parsedMsg.payload.result === "ACK"){
                    console.log("START_JOB ACK RECEIVED")
                    testChannel.send(JSON.stringify({
                        channel: 'EXECUTE_TASK',
                        payload: {
                            name: 'MAPREDUCE_REGION_SPLITS',
                            params: {
                                regionId: "69",
                                splits: ["first", "second", "third", "fourth", "fifth", "sixth"]
                            }
                        }
                    }))
                    testChannel.send(JSON.stringify({
                        channel: 'EXECUTE_TASK',
                        payload: {
                            name: 'MAPREDUCE_REGION_SPLITS',
                            params: {
                                regionId: "420",
                                splits: ["dog", "cat", "monkey", "sheep", "bird"]
                            }
                        }
                    }))
                } else {
                    console.log("START_JOB DID NOT RESPOND WITH ACK, NO BUENO")
                }
            }
        }
        /*
        let value = parseInt(e.data)
        console.log("received " + value++);
        testChannel.send(value.toString())*/
        /*setInterval(function(){ 
            console.log("send message " + value)
            testChannel.send(value.toString())
        }, 1000);*/
    }
}

function handleICECandidateEvent(payload) {
    return (e) => {
        if (e.candidate) {
            const peer = peers.find(p => p.id === payload.slaveId).peer
            const interval = setInterval(() => {
                if(peer.remoteDescription !== null && peer.localDescription !== null){
                    const icePayload = {
                        fromId: myId,
                        fromRole: role,
                        toId: payload.slaveId,
                        toRole: "NODE", 
                        candidate: e.candidate
                    }
                    socket.emit("ICE_CANDIDATE", icePayload);
                    clearInterval(interval)
                }
            }, 200)
        }
    }
}

socket.on('ANSWER_CONNECTION', payload => {
    console.log("Received ANSWER_CONNECTION from " + payload.slaveId + ", opening P2P")
    const desc = new RTCSessionDescription(payload.sdp);
    const peer = peers.find(p => p.id === payload.slaveId).peer
    peer.setRemoteDescription(desc).catch(e => console.log(e));
})

socket.on('ICE_CANDIDATE', payload => {
    const candidate = new RTCIceCandidate(payload.candidate);
    if(payload.fromId !== undefined){
        const p = peers.find(p => p.id === payload.fromId).peer
        const interval = setInterval(() => {
            if(p.remoteDescription !== null && p.localDescription !== null){
                p.addIceCandidate(candidate).catch(e => console.log(e));
                clearInterval(interval)
            }
        }, 200)
    }  
})
