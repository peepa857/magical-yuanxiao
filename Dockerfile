FROM node:12.20.1

WORKDIR /app

COPY . .

RUN npm install

ENV TZ Asia/Tokyo

EXPOSE 8888

CMD ["node" , "job.js" ]