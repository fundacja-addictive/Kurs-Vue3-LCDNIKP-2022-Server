import express from 'express';
import {Server} from 'socket.io';
import * as http from 'http';

var app = express();

// app.listen(8081);

app.get('/', function (req, res) {
    res.send('Hello world');
});

app.get('/folder', function (req, res) {
    res.send('Folder!');
});

var httpServer = http.createServer(app).listen(8082);

var io = new Server(httpServer, {
    cors: {
        origin: '*'
    }
});

io.on('connection', (socket) => {
    console.log('Connected', socket.id);
    socket.on('disconnect', function (reason) {
        console.log('Disconnected', socket.id);
    });

    socket.on('clicked', function (element) {
        console.log(element);
    });
});