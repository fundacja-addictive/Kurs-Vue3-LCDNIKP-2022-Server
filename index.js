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

const players = [];
/**
 * Player:
 * {
 *   socket: [Object],
 *   name: "Me the Player",
 *   ships: [Array],
 * }
 * 
 */

io.on('connection', (socket) => {
    if (players.length == 2)
        return socket.disconnect(true);

    var name = players.length == 1 ? 'first' : 'second';

    players.push({
        socket: socket,
        name: name,
        ships: [],
    });

    console.log(name + ' player logged in');

    socket.on('disconnect', function (reason) {
        var playerIndex = players.findIndex(p => p.socket.id == socket.id);

        players.splice(playerIndex, 1);

        console.log('Player is disconnected', socket.id);
    });

    socket.on('clicked', function (element) {
        console.log(element);
    });

    socket.on('allShipsPicked', function (data) {
        console.log('Player ' + socket.id + ' ready! ', JSON.stringify(data));

        players.forEach(p => {
            if (p.socket.id == socket.id)
                return;

            p.socket.emit('playerReady', {
                id: socket.id,
            });
        });
    })
});