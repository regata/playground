const { Server } = require('http');
const express = require('express');
const socketIO = require('socket.io');

const app = express();
const port = 3000;

// the path is relative to where the node is launched
app.use(express.static('app/public'));
app.use('/adapter.js', express.static('node_modules/webrtc-adapter/out/adapter.js'));

const server = Server(app);
const io = socketIO(server).of('/signalling');

let state = {
    peers: [],
    presenter: null
}

function update() {
    state.peers = Object.keys(io.sockets);
    return state;
}

io.on('connect', (socket) => {
    console.log(`connect: ${socket.id}`);
    console.log(update());

    io.emit('update', update());

    socket.on('disconnect', () => {
        console.log(`disconnect: peer_id = ${socket.id}`);
        io.emit('update', update());
    });

    socket.on('webrtc', (msg) => {
        if (!state.peers.includes(msg.to)) {
            console.error(`webrtc: missing recipient ${msg.to}`);
            return;
        }

        const from = socket.id;
        console.log(`webrtc: ${Object.keys(msg)} from ${from} to ${msg.to}`);
        io.to(msg.to).emit('webrtc', from, msg);
    });
});

server.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
