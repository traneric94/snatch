var socket = require('socket.io');
var express = require('express');
var http = require('http');
var eSession = require('express-session');
var sharedsession = require('express-socket.io-session');
var request = require('request');

var app = express();

var server = http.createServer(app);
var io = socket.listen(server);

var session = eSession({ secret: '*', resave: true, saveUninitialized: true });

app.use(session);
io.use(sharedsession(session, { autoSave: true }));

var rooms = {}; // {string: {closed: bool, clients: {int: bool}}}
var clientToRoom = {}; // int: string
var nextId = 0;
io.on('connection', function(client) {
	var clientId = client.handshake.session.id;
	if (clientId === undefined) {
		clientId = nextId++;
		client.handshake.session.id = clientId;
		client.handshake.session.save();
	}
	var roomName = clientToRoom[clientId];
	if (roomName !== undefined) {
		rooms[roomName].clients[clientId] = true;
		client.to(roomName).broadcast.emit({ endpoint: 'reconnect' });
	}
	client.on('disconnect', function() {
		var roomName = clientToRoom[clientId];
		if (roomName !== undefined) {
			var clients = rooms[roomName].clients;
			clients[clientId] = false;
			setTimeout(function() {
				checkEmptyRoom(roomName);
			}, 3000);
		}
	});
	client.on('room', function(data) {
		if (data.endpoint === 'join') {
			if (clientToRoom[clientId] === undefined) {
				var roomName = data.room;
				if (roomName !== undefined) {
					var room = rooms[roomName];
					if (room && room.closed) {
						client.send({
							endpoint: 'roomResponse',
							accepted: false,
						});
					} else {
						if (!room) {
							room = { closed: false, clients: [] };
							rooms[roomName] = room;
						}
						var index = Object.keys(room.clients).length;
						room.clients[clientId] = true;
						clientToRoom[clientId] = roomName;
						client.join(roomName);
						client.send({
							endpoint: 'roomResponse',
							index: index,
							accepted: true,
						});
					}
					return;
				}
			}
		} else if (data.endpoint === 'leave') {
			var roomName = clientToRoom[clientId];
			if (roomName !== undefined) {
				delete rooms[roomName].clients[clientId];
				delete clientToRoom[clientId];
				checkEmptyRoom(roomName);
				return;
			}
		} else if (data.endpoint === 'close') {
			var roomName = clientToRoom[clientId];
			if (roomName !== undefined) {
				rooms[roomName].closed = true;
			}
		}
		console.log('room', data);
	});
	client.on('message', function(data) {
		var roomName = clientToRoom[clientId];
		console.log('message', roomName, data);
		if (roomName !== undefined) {
			client.to(roomName).broadcast.emit('message', data);
		}
	});
});

function checkEmptyRoom(roomName) {
	var clients = rooms[roomName].clients;
	for (var otherClientId in clients) {
		if (clients[otherClientId]) return;
	}
	console.log('deleting room', roomName);
	for (var otherClientId in clients) {
		delete clientToRoom[otherClientId];
	}
	delete rooms[roomName];
}

app.use(express.static('public'));

app.use(function(err, req, res, next) {
	console.error('index err', err.stack);
});

app.use(function(req, res, next) {
	res.sendStatus(404);
});

var port = process.env.PORT || 8000;

server.listen(port, function() {
	console.log('listening on port ' + port);
});
