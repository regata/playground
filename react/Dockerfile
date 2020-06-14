FROM node:12

RUN mkdir /react

WORKDIR /react

COPY package.json package-lock.json /react/

RUN npm install

COPY ./ /react

# preserve node_modules when mounting source code from the host
VOLUME /react/node_modules

CMD ["/usr/local/bin/npm", "start"]
