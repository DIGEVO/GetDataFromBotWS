'use strict';

const FileSaver = require('file-saver');
const moment = require('moment-timezone');
require('moment/locale/es');

const wsReadyState2String = {
	0: 'CONNECTING',
	1: 'OPEN',
	2: 'CLOSING',
	3: 'CLOSED'
};

let ws = null;

try {
	var HOST = location.origin.replace(/^http/, 'ws')
	ws = new WebSocket(HOST);

	window[Symbol.for('ws.client')] = ws;

	ws.onopen = openEvent => {
		// TODO se podría guarda la operación actual en la cache.
		sendReload(ws);
	};

	ws.onclose = closeEvent => {
		$('#pleaseWaitDialog').modal('hide');
		console.log(`Websocket client has closed, code: ${closeEvent.code}, reason: ${closeEvent.reason ? closeEvent.reason : 'no reason'}`);
	};

	ws.onerror = errorEvent => {
		$('#pleaseWaitDialog').modal('hide');
		console.log('Websocket client: An error has occurred!');
	};

	ws.onmessage = messageEvent => {
		const message = JSON.parse(messageEvent.data);
		let action = message.event;

		if (action != "update") {
			$('#pleaseWaitDialog').modal('hide');
		}

		const actionHandlers = {
			'intents': () => { renderIntentsList(message.data, ws); },
			'reload': () => { renderTokenRequest(message.data, ws); },
			'errors': () => { renderErrors(message.data, ws); },
			'details': () => { downloadDetails(message.data, ws); },
			'update': () => { updateProgressBar(message.data, ws); },
			'default': () => {
				// TODO ver q hacer aqui
			}
		};

		if (!actionHandlers[action]) {
			action = 'default';
		}

		actionHandlers[action]();
	};

} catch (error) {
	console.error(error);
}

function downloadDetails({ data }, ws) {
	const filename = `botdata-${moment(new Date()).tz('America/Santiago').format().replace(/[:.]/g, '-')}.csv`;
	var file = new File([data], filename, { type: "text/plain;charset=utf-8" });
	FileSaver.saveAs(file);
}

function renderIntentsList({ intentsArr }, ws) {
	const content = document.getElementById("content");
	content.innerHTML = "";

	const h2 = document.createElement("h2");
	h2.innerText = "Por favor, seleccione las intenciones a descargar";

	const div1 = document.createElement("div");
	div1.className = "container center_div width_90";

	const form1 = document.createElement("form");
	form1.className = "form-group";
	form1.id = "intentsform";

	const ul = document.createElement("ul");
	ul.id = "intentslist";
	ul.className = "height-limiter";

	intentsArr.forEach(i => {
		const chk = document.createElement("input");
		chk.type = "checkbox";
		chk.name = "id";
		chk.value = i.id;
		chk.checked = true;

		const txt = document.createTextNode(`  ${i.name}`);

		const li = document.createElement("li");
		li.appendChild(chk);
		li.appendChild(txt);

		ul.appendChild(li);
	});

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-primary";
	button.id = "intentsbutton";
	button.textContent = "Descargar";
	button.onclick = sendSelectedIntents;

	const div2 = document.createElement("div");
	div2.className = "form-control-feedback";
	div2.id = "msgbox";

	form1.appendChild(ul);
	form1.appendChild(button);
	form1.appendChild(div2);

	const a = document.createElement("a");
	a.innerText = "Inicio";
	a.href = "";
	a.onclick = sendReload;

	div1.appendChild(form1);
	div1.appendChild(a);

	content.appendChild(h2);
	content.appendChild(document.createElement("br"));
	content.appendChild(div1);
}

function renderTokenRequest(data, ws) {
	const content = document.getElementById("content");
	content.innerHTML = "";

	const h2 = document.createElement("h2");
	h2.innerText = "Obtener intenciones según token de acceso al agente";

	const div1 = document.createElement("div");
	div1.className = "container center_div width_30";

	const form1 = document.createElement("form");
	form1.className = "form-inline";
	form1.autocomplete = "off";

	const textBox = document.createElement("input");
	textBox.type = "text";
	textBox.className = "form-control mb-2 mr-sm-2 mb-sm-0";
	textBox.id = "tokenbox";
	textBox.name = "tokenbox";
	textBox.placeholder = "Token de acceso";

	const button = document.createElement("button");
	button.type = "button";
	button.className = "btn btn-primary";
	button.id = "tokenbutton";
	button.textContent = "Cargar";
	button.onclick = sendToken;

	const div2 = document.createElement("div");
	div2.className = "form-control-feedback";
	div2.id = "msgbox";

	form1.appendChild(textBox);
	form1.appendChild(document.createElement("br"));
	form1.appendChild(document.createElement("br"));
	form1.appendChild(button);
	form1.appendChild(document.createElement("br"));
	form1.appendChild(document.createElement("br"));
	form1.appendChild(div2);

	div1.appendChild(form1);

	content.appendChild(h2);
	content.appendChild(document.createElement("br"));
	content.appendChild(div1);
}

function renderErrors({ errors }, ws) {
	$("#msgbox").text((errors || []).join("<br/>"));
}

function sendToken(event) {
	const ws = window[Symbol.for('ws.client')];
	if (!ws) return;

	if (!$("#tokenbox").val().trim()) {
		$("#msgbox").text("Se necesita el token para obtener intenciones");
		return;
	}

	$("#msgbox").text("");

	const msg = {
		event: "token",
		data: { token: $("#tokenbox").val() }
	};

	sendMsg(ws, msg);
	$('#pleaseWaitDialog').modal('show');
}

function sendSelectedIntents(event) {
	const ws = window[Symbol.for('ws.client')];
	if (!ws) return;

	$("#msgbox").text("");

	const selectedInputs = $("input[name='id']:checked:enabled", '#intentsform');

	const selectedIds = [...selectedInputs].map(i => i.value);

	const msg = {
		event: "ids",
		data: { ids: selectedIds }
	};

	sendMsg(ws, msg);
	$('#pleaseWaitDialog').modal('show');
}

function sendReload(ws) {
	if (!ws) return;

	const msg = {
		event: "reload",
		data: {}
	};

	sendMsg(ws, msg);
}

function sendMsg(ws, msg) {
	if (ws.readyState != WebSocket.OPEN) {
		console.log("webSocket is not open: " + wsReadyState2String[ws.readyState]);
		return;
	}

	ws.send(JSON.stringify(msg));
}

function updateProgressBar({ percent }, ws) {
	//style="width: 100%">
	$("#progressbar").width(`${percent}%`);
}
