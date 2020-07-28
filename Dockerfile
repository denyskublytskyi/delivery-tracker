FROM node:12-alpine

ENV WORKDIR         /usr/src/app
WORKDIR             $WORKDIR

COPY package*.json  ./
COPY index.js       ./
COPY .env.example   ./
COPY src            ./src

# TODO: move to separate Docker image
RUN apk update && apk upgrade && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories && \
    echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories && \
    apk add --no-cache \
          chromium@edge=81.0.4044.113-r0 \
          nss@edge \
          freetype@edge \
          freetype-dev@edge \
          harfbuzz@edge \
          ttf-freefont@edge

# Tell Puppeteer to skip installing Chrome. We'll be using the installed package.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROME_BIN=/usr/bin/chromium-browser

RUN npm ci --production

CMD npm start
