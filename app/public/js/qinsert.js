// (function() {
var startingHandSize = 6;
var startingBoardSize = 5;

var socket;

var currentPlayer = 0; // int
var myIndex; // int
var players = []; // [{name: string, hand: [int]}]
var deck; // [int]
var terms; // [{index: int, word: string, definition: string, image: string}]
var board = []; // [int]

function main() {
	connectSocket();
	$('#register_form').submit(register);
	$('#start_host').submit(sendStart);
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
		players[data.index] = { name: data.name, hand: [] };
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
	var setId = $('#set_id_input').val();
	$.get('/query?id=' + setId, function(response) {
		terms = response.terms;
		deal();
		send({
			endpoint: 'start',
			title: response.title,
			setId: response.id,
			players: players,
			terms: terms,
			deck: deck,
			board: board,
		});
	});
	return false;
}

function deal() {
	deck = terms
		.map(function(term) {
			return term.index;
		})
		.sort(function() {
			return Math.random() - 0.5;
		});
	for (var i = 0; i < startingHandSize; i++) {
		players.forEach(function(player) {
			player.hand.push(deck.shift());
		});
	}

	for (var i = 0; i < startingBoardSize; i++) {
		board.push(deck.shift());
	}
	sortBoard();
}

function sortBoard() {
	board.sort(function(a, b) {
		return a - b;
	});
}

function start(data) {
	$('#set_title').text(data.title);
	$('#set_id').text(data.setId);
	players = data.players;
	board = data.board;
	terms = data.terms;
	deck = data.deck;

	render();

	$('#start').hide();
	$('#game').show();
}

function render() {
	$('#current_player').text(players[currentPlayer].name);
	$('#players').empty();
	players.forEach(function(player) {
		$('<div>')
			.addClass('bubble')
			.addClass('inline')
			.append($('<p>').text('Name: ' + player.name))
			.append($('<p>').text('Cards in Hand: ' + player.hand.length))
			.appendTo('#players');
	});
	$('#hand').empty();
	players[myIndex].hand.forEach(function(index) {
		$('<div>')
			.addClass('center-parent')
			.addClass('bubble')
			.addClass('card')
			.append($('<p>').text(terms[index].word))
			.append($('<br>'))
			.append($('<img>').attr('src', terms[index].image))
			.addClass('hand_card')
			.click(pick)
			.appendTo('#hand');
	});
	$('#board').empty();
	board.forEach(function(index, position) {
		makeBoardButton();
		$('<div>')
			.addClass('center-parent')
			.addClass('bubble')
			.addClass('card')
			.append($('<p>').text(terms[index].word))
			.append($('<p>').text(terms[index].definition))
			.append($('<img>').attr('src', terms[index].image))
			.appendTo('#board');
	});
	makeBoardButton();
}

function makeBoardButton() {
	$('<button>')
		.addClass('bubble')
		.addClass('card')
		.addClass('board-button')
		.click(play)
		.appendTo('#board');
}

function pick() {
	if (myIndex !== currentPlayer) {
		alert('Not your turn!');
		return;
	}
	$('.hand_card').removeClass('selected');
	$(this).addClass('selected');
}

function play() {
	var selectedIndex = $('.hand_card.selected').index();
	if (selectedIndex === -1) {
		alert('select a card from your hand first');
		return;
	}
	var pickIndex = players[myIndex].hand.splice(selectedIndex, 1)[0];
	var position = $(this).index() / 2;
	var correct = isCorrect(pickIndex, position);
	var selector = correct ? '#correct_answer' : '#wrong_answer';
	send({ endpoint: 'showImg', selector: selector });
	board.splice(position, 0, pickIndex);
	if (!correct) {
		if (deck.length === 0) {
			send({ endpoint: 'alert', alert: 'Uh oh, we ran out of cards!' });
			return;
		}
		players[myIndex].hand.push(deck.shift());
		sortBoard();
	}
	var endpoint;
	if (correct && players[myIndex].hand.length === 0) {
		endpoint = 'victory';
	} else {
		endpoint = 'update';
		currentPlayer = (currentPlayer + 1) % players.length;
	}
	send({
		endpoint: endpoint,
		players: players,
		deck: deck,
		board: board,
		currentPlayer: currentPlayer,
	});
}

function isCorrect(pickIndex, position) {
	if (position !== 0) {
		if (pickIndex < board[position - 1]) {
			return false;
		}
	}
	if (position !== board.length) {
		if (pickIndex > board[position]) {
			return false;
		}
	}
	return true;
}

function showImg(data) {
	var selector = data.selector;
	$(selector).animate(
		{ 'margin-right': '-100%' },
		{
			duration: 1200,
			easing: 'linear',
			done: function() {
				$(selector).css('margin-right', '100%');
			},
		}
	);
}

function victory(data) {
	players = data.players;
	board = data.board;
	render();
	$('#game').hide();
	$('#game_end').show();
	$('#winner').text(players[currentPlayer].name);
}

function update(data) {
	players = data.players;
	board = data.board;
	currentPlayer = data.currentPlayer;
	deck = data.deck;
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
	update: update,
	victory: victory,
	alert: alertF,
	showImg: showImg,
};

$(document).ready(main);
// })();
