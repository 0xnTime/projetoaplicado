FROM docker.io/oven/bun:1
COPY --from=docker.io/library/node:24-slim /usr/local/bin/node /usr/local/bin/node
WORKDIR /repo
