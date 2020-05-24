'use strict';

const mediaStreamConstraints = {
  video: true,
};

// configure STUN and TURN servers here
const rtcConfig = {
    iceServers: [{
        urls: "stun:stun.services.mozilla.com",
        username: "louis@mozilla.com", 
        credential: "webrtcdemo"
    }]
};

const offerOptions = {
  offerToReceiveVideo: 1,
};

const peersDiv = document.getElementById('peers');
const videoButton = document.getElementById('startVideo');
const myVideo = document.getElementById('myVideo');

videoButton.addEventListener('click', startStopVideo);

let stream;

async function startStopVideo() {
    this.disabled = true;

    const shouldStart = this.innerText == 'Start my video';

    if (shouldStart) {
        stream = await window.navigator.mediaDevices.getUserMedia(
            mediaStreamConstraints);
        myVideo.srcObject = stream;

        await sendStream(stream);
    } else {
        myVideo.srcObject = null;
        stream.getTracks().forEach(track => track.stop());
        stream = null;
        disconnectStream();
    }

    this.innerText = shouldStart ? 'Stop my video' : 'Start my video';
    this.disabled = false;
}

function createVideoElement(peerId) {
    const video = document.createElement('video');
    video.id = peerId;
    video.width = 200;
    video.height = 200;
    video.autoplay = true;
    return video;
}

async function establishOutConnection(peerId, stream) {
  if (connectionsOut.has(peerId)) {
    console.warn(`overwriting existing outbound conn for ${peerId}`);
    connectionsOut.get(peerId).close();
    connectionsOut.delete(peerId);
  }

  console.log(`Establishing outbound connection to ${peerId}`);
  
  const conn = new RTCPeerConnection(rtcConfig);
  connectionsOut.set(peerId, conn);

  conn.onicecandidate = (event) => {
    const iceCandidate = event.candidate;
    if (iceCandidate) {
        socket.emit('webrtc',
                    {to: peerId, incandidate: iceCandidate});
    } else {
        // All ICE candidates have been sent
    }
  };

  stream.getTracks().forEach(track => conn.addTrack(track, stream));

  const offer = await conn.createOffer(offerOptions);
  await conn.setLocalDescription(offer);

  socket.emit('webrtc', {to: peerId, offer: offer});
}

async function establishInConnection(peerId, offer, video) {
    if (connectionsIn.has(peerId)) {
        console.warn(`overwriting existing inbound conn for ${peerId}`);
        connectionsIn.get(peerId).close();
        connectionsIn.delete(peerId);
    }

    const conn = new RTCPeerConnection(rtcConfig);
    connectionsIn.set(peerId, conn);

    conn.onicecandidate = (event) => {
        const iceCandidate = event.candidate;
        if (iceCandidate) {
            socket.emit('webrtc',
                        {to: peerId, outcandidate: iceCandidate});
        } else {
            // All ICE candidates have been sent
        }
    };

    conn.ontrack = (event) => {
      video.srcObject = event.streams[0];
    }

    await conn.setRemoteDescription(offer);
    const answer = await conn.createAnswer();
    await conn.setLocalDescription(answer);

    socket.emit('webrtc', {to: peerId, answer: answer});

    return conn;
}

async function sendStream(stream) {
    state.peers.forEach(async (peerId) => {
        if (peerId == myId) return;
        await establishOutConnection(peerId, stream);
    });
}

function disconnectStream() {
    connectionsOut.forEach( (conn, peerId) => {
        conn.close();
        connectionsOut.delete(peerId);
    });
}

const socket = io.connect('http://localhost:3000/signalling');

let connectionsIn = new Map();
let connectionsOut = new Map();
let myId = null;
let state = null;

socket.on('connect', () => {
    myId = socket.id;
    console.log(`connected: myId = ${myId}`);
});

socket.on('update', async (newState) => {
    console.log(`on update: ${JSON.stringify(newState)}`);
    peersCount.innerText = newState.peers.length;

    state = newState;

    for (const id of connectionsIn.keys()) {
        if (state.peers.indexOf(id) == -1) {
            const conn = connectionsIn.get(id);
            conn.close();
            connectionsIn.delete(id);
            let video = document.getElementById(id);
            if (video) video.remove();
        }
    }

    for (const id of connectionsOut.keys()) {
        if (state.peers.indexOf(id) == -1) {
            const conn = connectionsOut.get(id);
            conn.close();
            connectionsOut.delete(id);
        }
    }

    if (stream) {
        state.peers.forEach( async peerId => {
            if (!connectionsOut.has(peerId) && peerId != myId) {
                // TODO: check why new peers don't get connection established properly
                await establishOutConnection(peerId, stream);
            }
        });
    }
});

socket.on('webrtc', async (from, msg) => {
    if (!state.peers.includes(from)) {
        console.error(`Got a message from missing peer ${from}`);
        console.error(Object.keys(msg));
        return;
    }
    
    if (msg.incandidate) {
        const conn = connectionsIn.get(from);
        if (!conn) {
            console.error(`Got an incandidate from ${from} without a connection`);
            return;
        }
        await conn.addIceCandidate(new RTCIceCandidate(msg.incandidate));
    }

    if (msg.outcandidate) {
        const conn = connectionsOut.get(from);
        if (!conn) {
            console.error(`Got an outcandidate from ${from} without a connection`);
            return;
        }
        await conn.addIceCandidate(new RTCIceCandidate(msg.outcandidate));
    }

    if (msg.offer) {
        let video = document.getElementById(from);
        if (video) video.remove();

        video = createVideoElement(from);
        document.getElementById('peers').appendChild(video);

        await establishInConnection(from, msg.offer, video);
    }

    if (msg.answer) {
        const conn = connectionsOut.get(from);
        if (!conn) {
            console.error(`Got an answer from ${from} without a connection`);
            return;
        }

        await conn.setRemoteDescription(new RTCSessionDescription(msg.answer));
    }
});
