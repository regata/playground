'use strict';

const mediaStreamConstraints = {
  video: true,
};

// configure STUN and TURN servers here
const rtcConfig = {
    iceServers: [{
        urls: ['stun:stun.l.google.com:19302',
               'stun:stun1.l.google.com:19302']
    }]
};

const offerOptions = {
  iceRestart: true // required to get webrtc working for newly joined peers
};

let stream;

const socket = io.connect('http://localhost:3000');

let connectionsIn = new Map();
let connectionsOut = new Map();
let myId = null;
let state = null;

const peersDiv = document.getElementById('peers');
const videoButton = document.getElementById('startVideo');
const shareButton = document.getElementById('shareScreen');
const myVideo = document.getElementById('myVideo');

videoButton.addEventListener('click', startStopVideo);

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
    // the code below is to get things working in chrome
    video.muted = true;
    video.onloadedmetadata = (event) => {
      video.play();
    };
    return video;
}

function addStateDebugHandlers(kind, conn) {
  conn.oniceconnectionstatechange = (event) => {
    console.log(`${kind} oniceconnectionstatechange: ${conn.iceConnectionState}`);
  };

  conn.onicegatheringstatechange = (event) => {
    console.log(`${kind} onicegatheringstatechange: ${conn.iceGatheringState}`);
  };

  conn.onsignalingstatechange = (event) => {
    console.log(`${kind} onsignalingstatechange: ${conn.signalingState}`);
  };

  conn.onconnectionstatechange = (event) => {
    console.log(`${kind} onconnectionstatechange: ${conn.connectionState}`);
  }
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

  // addStateDebugHandlers('OUT', conn);

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

  await conn.setLocalDescription(await conn.createOffer(offerOptions));
  socket.emit('webrtc', {to: peerId, offer: conn.localDescription});
}

async function establishInConnection(peerId, offer, video) {
    if (connectionsIn.has(peerId)) {
        console.warn(`overwriting existing inbound conn for ${peerId}`);
        connectionsIn.get(peerId).close();
        connectionsIn.delete(peerId);
    }

    const conn = new RTCPeerConnection(rtcConfig);
    connectionsIn.set(peerId, conn);

    // addStateDebugHandlers('IN', conn);

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
    await conn.setLocalDescription(await conn.createAnswer());
    socket.emit('webrtc', {to: peerId, answer: conn.localDescription});
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

socket.on('connect', () => {
    myId = socket.id;
    console.log(`on connect: myId = ${myId}`);
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
                await establishOutConnection(peerId, stream);
            }
        });
    }
});

function webrtcMessageType(msg) {
    const types = new Set(['incandidate', 'outcandidate', 'offer', 'answer']);
    for (const key of Object.keys(msg)) {
        if (types.has(key)) return key.toUpperCase();
    }
}

socket.on('webrtc', async (from, msg) => {
    // console.log(`on webrtc: ${webrtcMessageType(msg)} from ${from}`);

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
        const c = new RTCIceCandidate(msg.incandidate);
        // console.log(c);
        await conn.addIceCandidate(c);
    }

    if (msg.outcandidate) {
        const conn = connectionsOut.get(from);
        if (!conn) {
            console.error(`Got an outcandidate from ${from} without a connection`);
            return;
        }
        const c = new RTCIceCandidate(msg.outcandidate);
        // console.log(c);
        await conn.addIceCandidate(c);
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
