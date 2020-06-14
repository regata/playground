# React 'Hello World'

Build docker image
```shell
docker build -t react .
```

Run demo
```shell
docker run --rm -it -p 8080:8080 -v $(pwd):/react react
```