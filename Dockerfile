FROM node:16-alpine

ENV WORKDIR         /usr/src/app
WORKDIR             $WORKDIR

COPY package*.json  ./
COPY index.js       ./
COPY .env.example   ./
COPY src            ./src

RUN apk add --no-cache \
      chromium=86.0.4240.111-r0 \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN npm ci --production

CMD npm start
