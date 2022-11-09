const RTCPeerConnection = require('wrtc').RTCPeerConnection;
const RTCSessionDescription = require('wrtc').RTCSessionDescription;
const RTCIceCandidate = require('wrtc').RTCIceCandidate;
const fs = require('fs');

const io = require("socket.io-client");

const MAP_WORKERS_REQUESTED = 2;
const REDUCE_WORKERS_REQUESTED = 1;
const REGIONS = 10;

const MAP_FUNCTION = "(s) => { return ['test', 1] }";
const REDUCE_FUNCTION = "(v1, v2) => { return v1 + v2 }";
const MY_ID = "IE_" + Date.now().toString();
const ROLE = "INVOKING_ENDPOINT"
const PREFIX = '.\\generated\\region-';
const SUFFIX = '.json';
const OPERATION_ID = (Date.now() + 100).toString();
const CONNECTION_STRING = 'http://ec2-3-208-18-248.compute-1.amazonaws.com:8000';

/* ------------------ */

let resultsReceived = 0;
const regionsToSend = new Array();
for(let i = REGIONS - 1; i >= 0; i--){
    let rawdata = fs.readFileSync(PREFIX + i + SUFFIX);
    regionsToSend.push(JSON.parse(rawdata));
}
console.log("DATA LOADED");
if(REGIONS !== regionsToSend.length){
    throw new Error("the number of data loaded and the REGIONS do not match");
}

let recruitmentRequestAlreadySent = false;
let peer = undefined;

var socket = io.connect(CONNECTION_STRING, {reconnect: true, query: {"id": MY_ID, "role": ROLE}});
socket.on('connect', function (s) {
    if(recruitmentRequestAlreadySent === false){
        recruitmentRequestAlreadySent = true;
        const types = new Array();
        types.push("DESKTOP");
        const payload = {
            operationId: OPERATION_ID,
            nodesToReach: 1,
            masterId: MY_ID,
            masterRole: ROLE,
            deviceTypes: types
        }
        console.log('Sending RECRUITMENT_REQUEST')
        socket.emit('RECRUITMENT_REQUEST', payload);
    }
});

socket.on('connect_error', function (err) {
    console.log("Broker " + err.message);
});

socket.on('RECRUITMENT_ACCEPT', payload => {
    console.log("Received RECRUITMENT_ACCEPT from " + payload.slaveId);

    peer = new RTCPeerConnection({
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

    peer.onconnectionstatechange = (event) => {
        console.log(event.type + " " + peer.connectionState)
    };

    peer.onicecandidate = handleICECandidateEvent(payload);

    const dataChannel = peer.createDataChannel("");
    dataChannel.onmessage = handleDataChannelMessage(dataChannel);
    
    dataChannel.onopen = function(event) {
        const interval = setInterval(() => {
            if(dataChannel.readyState === "open"){
                clearInterval(interval);
                console.log("P2P connection is ready, sending START_JOB")
                dataChannel.send(JSON.stringify({
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
        }, 100)
    }

    peer.createOffer().then(offer => {
        return peer.setLocalDescription(offer);
    }).then(() => {
        console.log("Sending REQUEST_CONNECTION to " + payload.slaveId)
        payload.sdp = peer.localDescription
        socket.emit("REQUEST_CONNECTION", payload)
    }).catch(e => console.log(e));
})

socket.on('ANSWER_CONNECTION', payload => {
    console.log("Received ANSWER_CONNECTION from " + payload.slaveId + ", opening P2P")
    const desc = new RTCSessionDescription(payload.sdp);
    peer.setRemoteDescription(desc).catch(e => console.log(e));
})

socket.on('ICE_CANDIDATE', payload => {
    const candidate = new RTCIceCandidate(payload.candidate);
    if(payload.fromId !== undefined){
        const interval = setInterval(() => {
            if(peer.remoteDescription !== null && peer.localDescription !== null){
                console.log("received ICE CANDIDATE")
                peer.addIceCandidate(candidate).catch(e => console.log(e));
                clearInterval(interval)
            }
        }, 100)
    }  
})

function handleICECandidateEvent(payload) {
    return (e) => {
        if (e.candidate) {
            const interval = setInterval(() => {
                if(peer.remoteDescription !== null && peer.localDescription !== null){
                    const icePayload = {
                        fromId: MY_ID,
                        fromRole: ROLE,
                        toId: payload.slaveId,
                        toRole: "NODE", 
                        candidate: e.candidate
                    }
                    console.log("sending ICE CANDIDATE")
                    socket.emit("ICE_CANDIDATE", icePayload);
                    clearInterval(interval)
                }
            }, 100)
        }
    }
}

function handleDataChannelMessage(dataChannel){
    return (e) => {
        const parsedMsg = JSON.parse(e.data);
        switch(parsedMsg.channel){
            case "START_JOB": {
                if(parsedMsg.payload.result === "ACK"){
                    console.log("START_JOB ACK for MAPREDUCE_MASTER received")
                    const r = regionsToSend.pop();
                    console.log("sending region " + r.regionId);
                    dataChannel.send(JSON.stringify({
                        channel: 'EXECUTE_TASK',
                        payload: {
                            name: 'MAPREDUCE_REGION_SPLITS',
                            params: r
                        }
                    }));
                } else {
                    console.log("START_JOB DID NOT RESPOND WITH ACK, NO BUENO")
                }
            } break;
            case 'EXECUTE_TASK': {
                if(parsedMsg.payload.result === "ACK"){
                    console.log("received EXECUTE_TASK ACK for MAPREDUCE_REGION_SPLITS")
                    const r = regionsToSend.pop();
                    if(r !== undefined){
                        console.log("sending region " + r.regionId);
                        const interval = setInterval(() => {
                            clearInterval(interval);
                            dataChannel.send(JSON.stringify({
                                channel: 'EXECUTE_TASK',
                                payload: {
                                    name: 'MAPREDUCE_REGION_SPLITS',
                                    params: r
                                }
                            }));
                        }, 50)
                    }
                } else {
                    console.log("EXECUTE_TASK DID NOT RESPOND WITH ACK, NO BUENO")
                }
            } break;
            case 'TASK_COMPLETED': {
                console.log("received TASK_COMPLETED for region " + parsedMsg.payload.params.regionId + " with result:\n" + parsedMsg.payload.params.result + "\nreceived: " + ++resultsReceived + "\n")
            } break;
        }
    }
}