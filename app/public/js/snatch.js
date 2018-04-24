// (function() {
var socket;

var currentPlayer = 0; // int
var myIndex; // int
var players = []; // [{name: string, words: [string]}]
var deck; // [char]
var board = []; // [char]

function main() {
	connectSocket();
	$('#register_form').submit(register);
	$('#start_host').click(sendStart);
	$('#flip_button').click(flip);
}

function connectSocket() {
	socket = io();
	socket.on('connect', function() {
		console.log('connected');
	});
	socket.on('message', receive);
}

function send(data) {
	receive(data);
	socket.send(data);
}

function receive(data) {
	var endpoint = data.endpoint;
	var f = endpoints[endpoint];
	if (f) {
		console.log(endpoint);
		f(data);
	} else {
		console.log('receive', endpoint, data);
	}
}

function register() {
	socket.emit('room', { endpoint: 'join', room: $('#room_input').val() });
	return false;
}

function roomResponse(data) {
	if (!data.accepted) {
		alert('Room is closed.');
		return;
	}
	myIndex = data.index;
	var name = $('#name_input').val();
	send({ endpoint: 'join', index: myIndex, name: name });
	$('#welcome').hide();
	$('#start').show();
	$(myIndex === 0 ? '#start_host' : '#start_wait').show();
}

function join(data) {
	if (myIndex === 0) {
		players[data.index] = { name: data.name, words: [] };
		send({ endpoint: 'updatePlayers', players: players });
	}
}

function updatePlayers(data) {
	players = data.players;
	$('#start_players').empty();
	players.forEach(function(player) {
		$('<p>')
			.text(player.name)
			.appendTo('#start_players');
	});
}

function sendStart() {
	deal();
	send({
		endpoint: 'start',
		players: players,
		deck: deck,
		board: board,
	});
}

function deal() {
	deck = [];
	console.log("deal");
	$.getJSON('letters.json', function(data) {
		for (var i = 0; i < Object.keys(data.bananagrams).length; i++) {
			j = Object.entries(data.bananagrams)[i][1];
			while (j > 0) {
				deck.push(Object.entries(data.bananagrams)[i][0]);
				j--;
			}
		}

    }).
      	success(function() {
      		for (i = deck.length-1; i > 0; i--) {
    			const j = Math.floor(Math.random() * (i + 1));
    			[deck[i], deck[j]] = [deck[j], deck[i]];
    		}
    		console.log(deck)
      	}).
        error(function(jqXHR, textStatus, errorThrown) {
        alert('error ' + textStatus + ' ' + errorThrown);
    })
       
    
}

function start(data) {
	players = data.players;
	deck = data.deck;
	board = data.board;

	render();

	$('#start').hide();
	$('#game').show();
}

function render() {
	$('#current_player').text(players[currentPlayer].name);
	$('#players').empty();
	players.forEach(function(player) {
		var playerDiv = $('<div>')
			.addClass('bubble')
			.addClass('inline')
			.append($('<p>').text('Name: ' + player.name))
			.appendTo('#players');
		player.words.forEach(function(word) {
			// TODO
		})
	});
	$('#board').empty();
	$('#board').text(board.join(''));

	$('#flip_button').prop('disabled', currentPlayer !== myIndex);
}

function flip() {
	send({endpoint: 'turn'});
}

function turn() {
	currentPlayer = (currentPlayer + 1) % players.length;
	var letter = deck.pop(0);
	board.append(letter);
	render();
}

function alertF(data) {
	alert(data.alert);
}

var endpoints = {
	roomResponse: roomResponse,
	join: join,
	updatePlayers: updatePlayers,
	start: start,
	turn: turn,
	alert: alertF,
};

$(document).ready(main);
// })();
