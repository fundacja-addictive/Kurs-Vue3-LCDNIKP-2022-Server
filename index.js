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
        var opponentIndex = getOpponentIndex(playerIndex);

        if (checkHit(opponentIndex, coordinates)) {
            io.to('game').emit('hit', {
                hitBy: playerIndex,
                coordinates: coordinates,
            });

            var checkedShip = checkAndGetDeadShip(opponentIndex, coordinates);

            if (checkedShip) {
                io.to('game').emit('hitAndDead', checkedShip);
                players[opponentIndex].ships.find(ship => ship.id == checkedShip.id).isDead = true;

                if (getShipsLeft(opponentIndex) == 0) {
                    io.to('game').emit('gameEnd', {});
                    players[opponentIndex].socket.emit('youLoose');
                    players[playerIndex].socket.emit('youWin');
                }
            }
        } else {
            io.to('game').emit('miss', {
                coordinates: coordinates,
            });
            socket.emit('blockPicking', true);
            players[opponentIndex].socket.emit('yourTurn', true);
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

/**
 * Checks if hitting given coordinates results in a dead ship for given player's board
 * 
 * @param {int} playerIndex Is player 0 or 1?
 * @param {object} coordinates {x:...,y:...}
 * @returns bool
 */
function checkAndGetDeadShip (playerIndex, coordinates) {
    var ships = players[playerIndex].ships;

    var hitShip = null;

    ships.forEach(ship => {
        ship.nodes.forEach(node => {
            if (coordinates.x == node.x && coordinates.y == node.y) {
                console.log('Hit ship', ship);
                hitShip = ship; 
            }
        });
    });
    
    var hitNodes = 0;

    if (hitShip) {
        hitShip.nodes.forEach(node => {
            if (node.hit) 
                    hitNodes++; /// ====   hitNodes += 1;  ====  hitNodes = hitNodes + 1; 
        });
    
        if (hitShip.nodes.length == hitNodes) {
            return hitShip;
        }
    }

    return false;
}

/**
 * Returns index of given player's opponent.
 * 
 * @param {int} playerIndex Index of a player to check
 * @returns int
 */
function getOpponentIndex (playerIndex) {
    switch (playerIndex) {
        case 0:
            return 1;
        case 1:
            return 0;
        default:
            throw "Player not found!";
    } 
}

/**
 * Returns count of not-dead ships for a given player
 * 
 * @param {int} playerIndex Index of a player to check
 * @returns int
 */
function getShipsLeft (playerIndex) {
    var shipsLeft = 0;

    players[playerIndex].ships.forEach(ship => {
        if (!ship.isDead)
            shipsLeft++;
    })
    
    return shipsLeft;
}