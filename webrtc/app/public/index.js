'use strict';

// Based on https://github.com/googlecodelabs/webrtc-web

// Set up media stream constant and parameters.

// In this codelab, you will be streaming video only: "video: true".
// Audio will not be streamed because it is set to "audio: false" by default.
const mediaStreamConstraints = {
  video: true,
};

// configure STUN and TURN servers here
const webrtcConfig = {
  iceServers: [{urls: "stun:stun.stunprotocol.org"}]
};

// Set up to exchange only video.
const offerOptions = {
  offerToReceiveVideo: 1,
};

// Define peer connections, streams and video elements.
const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');

let localStream;
let remoteStream;

let localPeerConnection;
let remotePeerConnection;

async function createLocalPeer(webrtcConfig) {
  const peer = new RTCPeerConnection(webrtcConfig);
  trace('LOCAL peer created');

  peer.onicecandidate = async (event) => {
    const iceCandidate = event.candidate;
    if (iceCandidate) {
        // trace(`LOCAL got iceCandidate: ${iceCandidate.candidate}`);
        await sendToRemote('icecandidate', iceCandidate);
    } else {
        // All ICE candidates have been sent
    }
  };

  peer.oniceconnectionstatechange = (event) => {
    trace(`LOCAL connection state changed: ${peer.iceConnectionState}`);
  };

  return peer;
}

async function createRemotePeer(webrtcConfig) {
  const peer = new RTCPeerConnection(webrtcConfig);
  trace('REMOTE peer created');

  peer.onicecandidate = async (event) => {
      const iceCandidate = event.candidate;
      if (iceCandidate) {
          // trace(`REMOTE got iceCandidate: ${iceCandidate.candidate}`);
          await sendToLocal('icecandidate', iceCandidate);
      } else {
          // All ICE candidates have been sent
      }
  };

  peer.oniceconnectionstatechange = (event) => {
    trace(`REMOTE connection state changed: ${peer.iceConnectionState}`);
  };

  peer.ontrack = (event) => {
    // TODO: check whether we need MediaStream and how to support multiple streams
    // const mediaStream = new MediaStream(event.streams);
    remoteStream = event.streams[0];
    remoteVideo.srcObject = remoteStream;
    trace('REMOTE added remote stream');
  }
 
  return peer;
}

// Signalling mocks

// local -> remote
async function sendToRemote(what, msg) {
    switch(what) {
        case 'icecandidate':
            await remotePeerConnection.addIceCandidate(msg);
            // trace(`REMOTE added candidate: ${msg.candidate}`);
            break;
        case 'offer':
            await remotePeerConnection.setRemoteDescription(msg);
            trace(`REMOTE set remote offer`);
            const answer = await remotePeerConnection.createAnswer();
            trace(`REMOTE created answer`);
            await remotePeerConnection.setLocalDescription(answer);
            return answer;
        default:
            console.error(what, msg);
    }
}

// remote -> local
async function sendToLocal(what, msg) {
    switch(what) {
        case 'icecandidate':
            await localPeerConnection.addIceCandidate(msg);
            // trace(`LOCAL added candidate: ${msg.candidate}`);
            break;
        case 'answer':
            await localPeerConnection.setRemoteDescription(msg);
            break;
        default:
            console.error(what, msg);
    }
}

// Define MediaStreams callbacks.
// Add behavior for video streams.

// Logs a message with the id and size of a video element.
function logVideoLoaded(event) {
  const video = event.target;
  trace(`${video.id} videoWidth: ${video.videoWidth}px, ` +
        `videoHeight: ${video.videoHeight}px.`);
}

// Logs a message with the id and size of a video element.
// This event is fired when video begins streaming.
function logResizedVideo(event) {
  logVideoLoaded(event);
}

localVideo.addEventListener('loadedmetadata', logVideoLoaded);
remoteVideo.addEventListener('loadedmetadata', logVideoLoaded);
remoteVideo.addEventListener('onresize', logResizedVideo);

// Define and add behavior to buttons.
const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');

// Set up initial action buttons status: disable call and hangup.
callButton.disabled = true;
hangupButton.disabled = true;

// Handles start button action: creates local MediaStream.
async function startAction() {
  startButton.disabled = true;
  trace('Requesting local stream.');

  try {
    localStream = await window.navigator.mediaDevices.getUserMedia(
        mediaStreamConstraints);
    localVideo.srcObject = localStream;
    trace('Received local stream.');
    callButton.disabled = false;  // Enable call button.
  } catch (err) {
    console.error(err);
  }
}

// Handles call button action: creates peer connection.
async function callAction() {
  trace('Starting call.');
  callButton.disabled = true;
  hangupButton.disabled = false;

  // Get local media stream tracks.
  const videoTracks = localStream.getVideoTracks();
  const audioTracks = localStream.getAudioTracks();

  localPeerConnection = await createLocalPeer(webrtcConfig);

  remotePeerConnection = await createRemotePeer(webrtcConfig);

  // Add local stream to connection and create offer to connect.
  localPeerConnection.addStream(localStream);
  trace('LOCAL added stream');

  try {
    const offer = await localPeerConnection.createOffer(offerOptions);
    trace(`LOCAL created offer`);
    await localPeerConnection.setLocalDescription(offer);
    trace(`LOCAL set local offer`);

    // send offer to remote
    const answer = await sendToRemote('offer', offer);

    // send answer to local
    await sendToLocal('answer', answer);
  } catch(err) {
    console.error(err);
  }
}

// Handles hangup action: ends up call, closes connections and resets peers.
function hangupAction() {
  localPeerConnection.close();
  remotePeerConnection.close();
  localPeerConnection = null;
  remotePeerConnection = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
  trace('Ending call.');
}

// Add click event handlers for buttons.
startButton.addEventListener('click', startAction);
callButton.addEventListener('click', callAction);
hangupButton.addEventListener('click', hangupAction);


// Define helper functions.

// Logs an action (text) and the time when it happened on the console.
function trace(text) {
  text = text.trim();
  const now = (window.performance.now() / 1000).toFixed(3);

  console.log(now, text);
}

const socket = io.connect('http://localhost:3000/signalling');
socket.on('news', (data) => {
  console.log(data);
  socket.emit('my other event', { my: 'data' });
});