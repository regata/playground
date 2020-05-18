# WebRTC Demo

## Running the demo

```sh
docker build -t node .
```

```sh
docker run -it --rm --name node -p 3000:3000 -v $(pwd)/app:/webrtc/app node bash
```

```sh
# inside container
npm start
```
