var WebSocket = require('ws');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');

const df = require('./dialogflow');

class BackendServer {
	constructor(server) {
		this.wss = new WebSocket.Server({ server });

		this.wss.on('connection', (ws, req) => {
			const sid = cookieParser.signedCookie(cookie.parse(req.headers.cookie)['connect.sid'], 'secret');

			ws.isAlive = true;
			ws.on('pong', () => { ws.isAlive = true; });

			ws.on('message', msg => {
				let message, event = 'default';

				try {
					message = JSON.parse(msg);
					event = message.event;
				} catch (error) {
					console.error(error);
				}

				const eventHandlers = {
					'reload': () => { df.reload(message.data, ws, sid); },
					'token': () => { df.processToken(message.data, ws, sid); },
					'ids': () => { df.processIds(message.data, ws, sid); },
					'default': () => {
						ws.send(`{"event":"errors", "data": {"errors":["An error has occurred."]}}`);
					}
				};

				if (!eventHandlers[event]) {
					event = 'default';
				}

				eventHandlers[event]();
			});

			ws.on('error', (err) => {
				console.warn(`Client disconnected - reason: ${err}`);
			})
		});

		setInterval(() => {
			this.wss.clients.forEach(ws => {
				if (!ws.isAlive) return ws.terminate();

				ws.isAlive = false;
				ws.ping(null, undefined);
			});
		}, 10000);
	}

}

module.exports = BackendServer;
