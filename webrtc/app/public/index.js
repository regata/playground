'use strict';

const mediaStreamConstraints = {
  video: true
};

const displayMediaOptions = {
    video: {
        cursor: "always"
    }
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

let videoStream;
let screenStream;
let videoTransceiver;
let screenTransceiver;

const socket = io.connect('http://localhost:3000');

let connectionsIn = new Map();
let connectionsOut = new Map();
let myId = null;
let state = null;

const peersDiv = document.getElementById('peers');
const videoButton = document.getElementById('startVideo');
const shareButton = document.getElementById('shareScreen');
const myVideo = document.getElementById('myVideo');
const shareScreenVideo = document.getElementById('presentation');

videoButton.addEventListener('click', startStopVideo);
shareButton.addEventListener('click', startStopSharing);

async function startStopVideo() {
    this.disabled = true;

    const shouldStart = this.innerText == 'Start my video';

    if (shouldStart) {
        videoStream = await window.navigator.mediaDevices.getUserMedia(
            mediaStreamConstraints);
        myVideo.srcObject = videoStream;
        await sendStreamsToPeers();
    } else {
        myVideo.srcObject = null;
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
        disconnectStream();
    }

    this.innerText = shouldStart ? 'Stop my video' : 'Start my video';
    this.disabled = false;
}

async function startStopSharing() {
    this.disabled = true;

    const shouldStart = this.innerText == 'Share my screen';

    if (shouldStart) {
        screenStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        shareScreenVideo.srcObject = screenStream;
        await sendStreamsToPeers();
    } else {
        shareScreenVideo.srcObject = null;
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
    }

    this.innerText = shouldStart ? 'Stop sharing' : 'Share my screen';
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

async function establishOutConnection(peerId, streams) {
  let conn;
  if (!connectionsOut.has(peerId)) {
    console.log(`Establishing outbound connection to ${peerId}`);
    conn = new RTCPeerConnection(rtcConfig);
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

    videoTransceiver = conn.addTransceiver('video', {direction: "sendonly"});
    screenTransceiver = conn.addTransceiver('video', {direction: "sendonly"});

    await conn.setLocalDescription(await conn.createOffer(offerOptions));
    socket.emit('webrtc', {to: peerId, offer: conn.localDescription});
  } else {
    console.log(`Updating outbound connection to ${peerId}`);
    conn = connectionsOut.get(peerId);
  }

  // stream.getTracks().forEach(track => conn.addTrack(track, stream));
  // create transceiver for each stream
  streams.forEach((stream, type) => {
    const track = stream.getVideoTracks()[0];
    if (type == 'video') {
      videoTransceiver.sender.replaceTrack(track);
    }

    if (type == 'screen') {
      screenTransceiver.sender.replaceTrack(track);
    }
  });

}

async function establishInConnection(peerId, offer, video) {
    let conn;
    if (!connectionsIn.has(peerId)) {
        console.log(`Establishing inbound connection from ${peerId}`);
        conn = new RTCPeerConnection(rtcConfig);
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

    } else {
        console.log(`Updating inbound connection from ${peerId}`);
        conn = connectionsIn.get(peerId);
    }

    conn.ontrack = (event) => {
        const transceiver = event.transceiver;

        if (transceiver.mid == conn.getTransceivers()[0].mid) {
            video.srcObject = new MediaStream([transceiver.receiver.track]);
        }

        if (transceiver.mid == conn.getTransceivers()[1].mid) {
            // HACK ALERT!
            video = document.getElementById('presentation');
            // enable autoplay
            video.muted = true;
            video.onloadedmetadata = (event) => {
                video.play();
            };
            video.srcObject = new MediaStream([transceiver.receiver.track]);
        }
    };

    await conn.setRemoteDescription(offer);
    await conn.setLocalDescription(await conn.createAnswer());
    socket.emit('webrtc', {to: peerId, answer: conn.localDescription});
}

async function sendStreamsToPeers() {
    let streams = new Map();

    if (videoStream) {
        streams.set('video', videoStream);
    }

    if (screenStream) {
        streams.set('screen', screenStream);
    }

    if (streams.size == 0) {
        return;
    }

    state.peers.forEach(async (peerId) => {
        if (peerId == myId) return;
        await establishOutConnection(peerId, streams);
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

    sendStreamsToPeers();
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
        if (!video) {
            video = createVideoElement(from);
            document.getElementById('peers').appendChild(video);
        }

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
