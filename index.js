import express from 'express';
import {Server} from 'socket.io';
import * as http from 'http';

var app = express();

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

/**
 * Player:
 * {
 *   socket: [Object],
 *   name: "Me the Player",
 *   ships: [Array],
 * }
 * 
*/
const players = [];

/**
 * Returns playerIndex associated with a given socket connection.
 * 
 * @param {Socket} socket socket client that we want to obtain player index for.
 * @returns int
 */
function getPlayerIndex (socket) {
    return socket.id;
}

// Declare listener on new socket connecting
io.on('connection', (socket) => {
    if (Object.keys(players).length == 2)
        return socket.disconnect(true);
    
    players[socket.id] = {
        socket: socket,
        name: null,
        ships: [],
    };

    socket.emit('yourId', socket.id);

    console.log('Player logged in ' + socket.id);

    socket.join('game');

    socket.on('greeting', function (data) {
        players[socket.id].name = data.name;
        console.log ('Hello from ' + data.name);
    });

    /**
     * 
     * Below declaring listeners for numerous events associated with player's connection
     * 
     */

    socket.on('disconnect', function (reason) {
        delete players[socket.id];

        console.log('Player is disconnected', socket.id);
    });

    socket.on('clicked', function (element) {
        console.log(element);
    });

    socket.on('allShipsPicked', function (data) {
        console.log('Player ' + socket.id + ' ready! ', JSON.stringify(data));

        socket.emit('blockPicking', true);

        var playerIndex = getPlayerIndex(socket);
        var opponentIndex = getOpponentIndex(playerIndex);

        for (const [index, p] of Object.entries(players)) {
            if (p.socket.id == socket.id) {
                p.ships = data;
            } else {
                p.socket.emit('opponentReady', {
                    id: socket.id,
                    name: players[playerIndex].name,
                });
            }
        }

        if (players[playerIndex].ships.length > 0 && players[opponentIndex].ships.length > 0) {
            io.to('game').emit('gameIsOn', true);

            var playerId = Object.keys(players)[
                Math.round(Math.random())
            ];

            players[playerId].socket.emit('yourTurn', true);
            console.log('Player\'s ' + playerId + ' turn');
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
                io.to('game').emit('hitAndDead', {
                    hitBy: playerIndex,
                    ship: checkedShip,
                });
                players[opponentIndex].ships.find(ship => ship.id == checkedShip.id).isDead = true;

                if (getShipsLeft(opponentIndex) == 0) {
                    io.to('game').emit('gameEnd', {});
                    players[opponentIndex].socket.emit('youLoose');
                    players[playerIndex].socket.emit('youWin');
                }
            }
        } else {
            io.to('game').emit('miss', {
                missBy: playerIndex,
                coordinates: coordinates,
            });
            socket.emit('blockPicking', true);
            players[opponentIndex].socket.emit('yourTurn', true);
        }
    });
});

/**
 * Checks if hitting given coordinates means hitting any ship of given player's.
 * 
 * @param {int} playerIndex 
 * @param {object} coordinates - {x: ... , y: ... }
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
    var opponent = null;
    for (const [index, p] of Object.entries(players)) {
        if (playerIndex != index)
            opponent = index;
    }

    if (!opponent)
        throw "Player not found!";

    return opponent;
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