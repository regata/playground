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

const signalling = io.of('signalling')
    .on('connection', (socket) => {
        console.log(`new connection: ${socket}`);
        socket.emit('news', { hello: 'world' });
        socket.on('my other event', (data) => {
          console.log(data);
        });
    });

server.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
