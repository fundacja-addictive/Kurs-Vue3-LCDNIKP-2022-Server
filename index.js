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

function getPlayerIndex (socket) {
    return players.findIndex(p => {
        if (p.socket.id == socket.id) {
            return true;
        }
    });
}

io.on('connection', (socket) => {
    if (players.length == 2)
        return socket.disconnect(true);

    
    var name = players.length == 0 ? 'first' : 'second';
    
    players.push({
        socket: socket,
        name: name,
        ships: [],
    });

    console.log(name + ' player logged in');

    socket.join('game');

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

        socket.emit('blockPicking', true);

        players.forEach(p => {
            if (p.socket.id == socket.id) {
                p.ships = data;
            } else {
                p.socket.emit('playerReady', {
                    id: socket.id,
                });
            }
        });

        if (players.length == 2 && players[0].ships.length > 0 && players[1].ships.length > 0) {
            io.to('game').emit('gameIsOn', true);

            players[0].socket.emit('yourTurn', true);
        }
    })

    socket.on('shoot', (data) => {
        var coordinates = data.coordinates; // {x:..., y:...}

        var playerIndex = getPlayerIndex(socket);

        console.log(playerIndex);

        if (playerIndex == 0) {
            // verify hit on player's 1 board
            if (checkHit(1, coordinates)) {
                io.to('game').emit('hit', {
                    hitBy: 0,
                    coordinates: coordinates,
                });

                if (checkDeadShip(0, coordinates)) {
                    io.to('game').emit('hitAndDead', {

                    });
                }
            } else {
                io.to('game').emit('miss', {
                    coordinates: coordinates,
                });
                socket.emit('blockPicking', true);
                players[1].socket.emit('yourTurn', true);
            }
        } else if (playerIndex == 1) {
            // verify hit on player's 0 board
            if (checkHit(0, coordinates)) {
                io.to('game').emit('hit', {
                    hitBy: 1,
                    coordinates: coordinates,
                });

                if (checkDeadShip(0, coordinates)) {
                    io.to('game').emit('hitAndDead', {

                    });
                }
            } else {
                io.to('game').emit('miss', {
                    coordinates: coordinates,
                });
                socket.emit('blockPicking', true);
                players[0].socket.emit('yourTurn', true);
            }
        } else {
            console.log('Cannot determine the other player!');
        }

    });
});

/**
 * 
 * 
 * @param {*} playerIndex 
 * @param {*} coordinates - {x: ... , y: ... }
 */
function checkHit (playerIndex, coordinates) {
    var ships = players[playerIndex].ships;

    var hit = false;

    ships.forEach((ship, i) => {
        ship.nodes.forEach((node, j) => {
            if (coordinates.x == node.x && coordinates.y == node.y) {
                // Why this is not saved?
                players[playerIndex].ships[i].nodes[j].hit = true; 
                hit = true;
            }
        })
    });

    return hit;
}

function checkDeadShip (playerIndex, coordinates) {
    var ships = players[playerIndex].ships;

    var hitShip = null;

    ships.forEach(ship => {
        ship.isDead = true;
        ship.nodes.forEach(node => {
            if (!node.hit)
                ship.isDead = false;

            if (coordinates.x == node.x && coordinates.y == node.y) {
                console.log('Hit ship', ship);
                hitShip = ship; 
            }
        });
    });

    return hitShip.isDead;
}