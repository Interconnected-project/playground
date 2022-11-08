const RTCPeerConnection = require('wrtc').RTCPeerConnection;
const RTCSessionDescription = require('wrtc').RTCSessionDescription;
const RTCIceCandidate = require('wrtc').RTCIceCandidate;

const io = require("socket.io-client");

const myId = "IE_" + Date.now();
const role = "INVOKING_ENDPOINT"
const OPERATION_ID = "008";
const MAP_FUNCTION = "(s) => { return [s, 1] }";
const REDUCE_FUNCTION = "(v1, v2) => { return v1 + v2 }";
const MAP_WORKERS_REQUESTED = 2;
const REDUCE_WORKERS_REQUESTED = 1;
const ANIMALS = ["dog", "cow", "cat", "pidgeon", "crocodile", "bee"];
const SPLITS_NUMBER = 10;
var splitsSent = 0;
const VALUES_PER_SPLIT = 500;
var accumulatedResults = 0;

const CONNECTION_STRING = 'http://ec2-3-73-1-24.eu-central-1.compute.amazonaws.com:8000';
// const CONNECTION_STRING = 'ws://localhost:8000';

console.log("STARTING INVOKING ENDPOINT");
var socket = io.connect(CONNECTION_STRING, {reconnect: true, query: {"id": myId, "role": role}});
var peers = [];

const types = new Array();
types.push("DESKTOP");

socket.on('connect', function (s) {
    var test = {
        operationId: OPERATION_ID,
        nodesToReach: 1,
        masterId: myId,
        masterRole: role,
        deviceTypes: types
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
              urls: "stun:openrelay.metered.ca:80",
            },
            {
              urls: "turn:openrelay.metered.ca:80",
              username: "openrelayproject",
              credential: "openrelayproject",
            },
            {
              urls: "turn:openrelay.metered.ca:443",
              username: "openrelayproject",
              credential: "openrelayproject",
            },
            {
              urls: "turn:openrelay.metered.ca:443?transport=tcp",
              username: "openrelayproject",
              credential: "openrelayproject",
            },
          ]
    });

    const testChannel = peer.createDataChannel("test");
    testChannel.onmessage = handleTestChannelMessage(testChannel);

    testChannel.onopen = function(event) {
        var readyState = testChannel.readyState;
        if (readyState == "open") {
            console.log("P2P connection is ready, send START_JOB with name MAPREDUCE_MASTER");
            console.log("Map workers requested: " + MAP_WORKERS_REQUESTED);
            console.log("Map function: " + MAP_FUNCTION)
            console.log("Reduce workers requested: " + REDUCE_WORKERS_REQUESTED);
            console.log("Reduce function: " + REDUCE_FUNCTION + "\n")
            testChannel.send(JSON.stringify({
                channel: 'START_JOB',
                payload: {
                    name: 'MAPREDUCE_MASTER',
                    params: {
                        mapWorkers: MAP_WORKERS_REQUESTED,
                        reduceWorkers: REDUCE_WORKERS_REQUESTED,
                        mapFunction : MAP_FUNCTION,
                        reduceFunction : REDUCE_FUNCTION,
                    }
                }
            }))
        }
      };

    peer.onicecandidate = handleICECandidateEvent(payload);
    peer.onconnectionstatechange = (event) => {
        // console.log(event.type + " " + peer.connectionState)
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
        switch(parsedMsg.channel){
            case "START_JOB": {
                if(parsedMsg.payload.result === "ACK"){
                    console.log("START_JOB ACK for MAPREDUCE_MASTER received")
                    const splits = new Array();
                    for(let i = 0; i < VALUES_PER_SPLIT; i++){
                        splits.push(ANIMALS[Math.floor(Math.random() * ANIMALS.length)])
                    }
                    console.log("sending EXECUTE_TASK named MAPREDUCE_REGION_SPLITS")
                    testChannel.send(JSON.stringify({
                        channel: 'EXECUTE_TASK',
                        payload: {
                            name: 'MAPREDUCE_REGION_SPLITS',
                            params: {
                                regionId: splitsSent,
                                splits: splits
                            }
                        }
                    }))
                    ++splitsSent;
                } else {
                    console.log("START_JOB DID NOT RESPOND WITH ACK, NO BUENO")
                }
            } break;
            case 'EXECUTE_TASK': {
                if(parsedMsg.payload.result === "ACK"){
                    console.log("received EXECUTE_TASK ACK for MAPREDUCE_REGION_SPLITS")
                    if(splitsSent < SPLITS_NUMBER){
                        const splits = new Array();
                        for(let i = 0; i < VALUES_PER_SPLIT; i++){
                            splits.push(ANIMALS[Math.floor(Math.random() * ANIMALS.length)])
                        }
                        console.log("sending EXECUTE_TASK named MAPREDUCE_REGION_SPLITS")
                        const foo = splitsSent;
                        const interv = setInterval(() => {
                            clearInterval(interv);
                            testChannel.send(JSON.stringify({
                                channel: 'EXECUTE_TASK',
                                payload: {
                                    name: 'MAPREDUCE_REGION_SPLITS',
                                    params: {
                                        regionId: foo,
                                        splits: splits
                                    }
                                }
                            }))
                        }, 50)
                        ++splitsSent;
                    }
                } else {
                    console.log("EXECUTE_TASK DID NOT RESPOND WITH ACK, NO BUENO")
                }
            } break;
            case 'TASK_COMPLETED': {
                console.log("received TASK_COMPLETED for region " + parsedMsg.payload.params.regionId + " with result:\n" + parsedMsg.payload.params.result + "\naccumulated: " + ++accumulatedResults + "\n")
            } break;
        }
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
