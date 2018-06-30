'use strict';

const rp = require('request-promise-native');
const NodeCache = require('node-cache');
const cache = new NodeCache({
	stdTTL: 1800
});

const wsReadyState2String = {
	0: 'CONNECTING',
	1: 'OPEN',
	2: 'CLOSING',
	3: 'CLOSED'
};

exports.processToken = ({ token }, ws, sid) => {
	rp
		.get(process.env.URL, {
			'auth': {
				'bearer': token
			}
		})
		.then(data => processData(data, ws, sid, token))
		.catch(error => processError(error, ws));
};

exports.processIds = async ({ ids }, ws, sid) => {
	const delay = time => new Promise(res => setTimeout(() => res(), time));
	await delay(1000);

	const _ids = ids || [];
	const cachedData = cache.get(sid);

	if (!cachedData.intentsArr) {
		const msg = {
			event: "errors",
			data: { errors: ['Por favor, vuelva a intentarlo.'] }
		}

		sendMsg(ws, msg);
		return;
	}

	if (!_ids.length) {
		const msg = {
			event: "errors",
			data: { errors: ['Debe seleccionar al menos una intención.'] }
		}

		sendMsg(ws, msg);
		return;
	}

	(async () => {
		let csvArr = [];
		// console.log(`-------------------------------> ${_ids.length}`);
		for (let i = 0; i < _ids.length; i++) {
			await (async () => {
				const delay = time => new Promise(res => setTimeout(() => res(), time));
				await delay(1500);
				console.log(`------------------------------------------------------------>>>> ${i + 1} of ${_ids.length}`);
				sendUpdate((i + 1) / _ids.length * 100, ws);

				const id = _ids[i];
				const value = await getPromiseRequest(id, cachedData.token);
				const intent = JSON.parse(value.replace(/\n/g, ' ').replace(/\x5C\x6E/g, '|'));
				csvArr.push(processIntent(intent, cachedData.intentsArr.find(o => o.id === intent.id)));
			})();
		}

		const S = String.fromCharCode(process.env.SEPARATOR);
		const header = `INTENT ID${S}INTENT NAME${S}TYPE${S}TEXT\n`;
		const data = `${header}${csvArr.join('\n')}`;

		const msg = {
			event: "details",
			data: { data: data }
		}

		sendMsg(ws, msg);
	})();
};

function processData(data, ws, sid, token) {
	const intentsArr = JSON.parse(data).map(o =>
		({
			id: o.id,
			name: o.name,
			events: o.events.map(e => e.name),
			parameters: o.parameters.map(p => JSON.stringify(p)),
			actions: o.actions
		}));

	cache.set(sid, {
		token: token,
		intentsArr: intentsArr
	});

	const msg = {
		event: "intents",
		data: { intentsArr: intentsArr }
	};

	sendMsg(ws, msg);
}

exports.reload = (data, ws, sid) => {
	// TODO se podría guarda la operación actual en la cache.
	const msg = {
		event: "reload",
		data: {}
	};

	sendMsg(ws, msg);
}

function sendUpdate(percent, ws) {
	const msg = {
		event: "update",
		data: { percent: percent }
	};

	sendMsg(ws, msg);
}

function processError(error, ws) {
	const err = JSON.parse(error.error);

	const msg = {
		event: 'errors',
		data: { errors: [err.status.errorDetails] }
	};

	sendMsg(ws, msg);
}

function getPromiseRequest(id, token) {
	return rp.get(
		process.env.URL_ID.replace(':id', id), {
			'auth': {
				'bearer': token
			}
		});
}

function processIntent(intent, refIntent) {
	const S = String.fromCharCode(process.env.SEPARATOR);

	const userSaysCsv = intent.userSays
		.map(o => o.data.map(o1 => o1.text).join(''))
		.map(s => `${intent.id}${S}${intent.name}${S}User Says${S}${s}`)
		.join('\n');

	const responses = intent.responses
		.map(o => [].concat.apply([], o.messages.map(m => [].concat(m.speech))));

	const responsesCsv = [].concat
		.apply([], responses)
		.map(s => `${intent.id}${S}${intent.name}${S}Response${S}${s}`)
		.join('\n');

	const eventsCsv = refIntent.events
		.map(e => `${intent.id}${S}${intent.name}${S}Event${S}${e}`)
		.join('\n');

	const actionsCsv = refIntent.actions
		.map(a => `${intent.id}${S}${intent.name}${S}Action${S}${a}`)
		.join('\n');

	const parametersCsv = refIntent.parameters
		.map(p => `${intent.id}${S}${intent.name}${S}Parameter${S}${p}`)
		.join('\n');

	return [userSaysCsv, responsesCsv, eventsCsv, actionsCsv, parametersCsv].filter(s => s).join('\n');
}

function sendMsg(ws, msg) {
	if (ws.readyState != 1) {
		console.log("webSocket is not open: " + wsReadyState2String[ws.readyState]);
		return;
	}

	ws.send(JSON.stringify(msg));
}