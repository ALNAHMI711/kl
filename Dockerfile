FROM node:22-alpine

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build && mkdir -p .next/cache && chown -R node:node .next

ENV NODE_ENV=production
EXPOSE 3000

USER node
CMD ["npm", "run", "start"]
