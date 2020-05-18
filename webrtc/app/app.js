const express = require('express')

const app = express();
const port = 3000;

// the path is relative to where the node is launched
app.use(express.static('app/public'));
app.use('/adapter.js', express.static('node_modules/webrtc-adapter/out/adapter.js'));

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
