FROM ubuntu:latest

WORKDIR /usr/src/app 

COPY package.json package-lock.json ./

RUN sudo apt update

COPY . .

EXPOSE 4000

CMD ["npm", "start"]