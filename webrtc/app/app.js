const { Server } = require('http');
const express = require('express');
const socketIO = require('socket.io');

const app = express();
const port = 3000;

// the path is relative to where the node is launched
app.use(express.static('app/public'));
app.use('/adapter.js', express.static('node_modules/webrtc-adapter/out/adapter.js'));

const server = Server(app);
const io = socketIO(server);

let state = {
    peers: [],
    presenter: null
}

function update() {
    state.peers = Object.keys(io.sockets.sockets);
    return state;
}

function webrtcMessageType(msg) {
    const types = new Set(['incandidate', 'outcandidate', 'offer', 'answer']);
    for (const key of Object.keys(msg)) {
        if (types.has(key)) return key.toUpperCase();
    }
}

io.on('connect', (socket) => {
    console.log(`on connect: ${socket.id}`);
    console.log(update());

    io.emit('update', update());

    socket.on('disconnect', () => {
        console.log(`on disconnect: peer_id = ${socket.id}`);
        io.emit('update', update());
    });

    socket.on('webrtc', (msg) => {
        if (!state.peers.includes(msg.to)) {
            console.error(`webrtc: missing recipient ${msg.to}`);
            return;
        }

        const msgType = webrtcMessageType(msg);
        if (!msgType) {
            console.warn(`Wrong message type: msg.keys = ${Object.keys(msg)}`);
            return;
        }

        const from = socket.id;
        console.log(`on webrtc: ${msgType} from ${from} to ${msg.to}`);
        io.to(msg.to).emit('webrtc', from, msg);
    });
});

server.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
