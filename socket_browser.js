
const row_keys = ['lc', 'c', 'a', 'b', 'h', 'l', 'ch', 'cp', 'sp', 'v', 'TIME']
const controllers = {
	main: ($scope, $http) => {
		$scope.header_row_cells = ['Name', 'Last Close', 'Current', 'Ask', 'Bid', 'High', 'Low', 'Change', 'Change%', 'Spread', 'Volume', 'Time'];
		$scope.row_keys = row_keys;
		$scope.currencies = [
			{ title: 'Forex', ex: 'Exchange 0', ids: ['EUR-USD', 'XAU-USD'] },
			{ title: 'Crypto Currency', ex: 'Exchange 1', ids: ['LTC-USD', 'XRP-USD'] },
			{ title: 'Crypto', ex: 'Exchange 2', ids: ['LTC', 'XRP'] },
		];
		$scope.show = true
		$scope.start = () => {
			funcs.socket_connection();
			funcs.start_conn();
			$scope.show = false;
		}
		$scope.stop = () => {
			funcs.disconnect()
			$scope.show = true;
		}
	}
}

const app = angular
	.module('myApp', [])
	.controller("index", controllers.main);

// Enter your API KEY here, with API_KEY only EUR/USD, XAU/USD are allow free.
var api_key = 'API_KEY'; // get from https://fcsapi.com/dashboard
/*
With Demo API_KEY only EUR/USD, XAU/USD, BTC,LTC prices are available, 
If you need more prices, then please enter your API KEY, Signup to get your API KEY.

EXCEL LIST:  https://fcsapi.com/beta/assets/socket/socket_support_list.xlsx
Enter your Forex/Crypto ids, set multiple ids with comma
*/
var currency_ids = '1,1984,80,81,7774,7778';

// Variables
var socket_re_conn, socket, heart_interval;

// wss:// if your application does not support WSS/SSL/HTTPS then use "ws://fcsapi.com" (http)
var main_url = 'wss://fcsapi.com'; // web socket URL
var backup_url = 'wss://fxcoinapi.com'; // web socket backup URL
var ws_url = main_url; // Web Socket

const gid = (id, data) => document.getElementById(id).innerHTML = data;

// Use backup server incase our main server is not accessible
// Note: Only use it for backup.
const funcs = {
	backup_server: () => {
		ws_url = backup_url; // backup URL
		funcs.socket_connection();
		gid('error', '');
		// keep try to connect with main server after 10 minute.
		// To test if backup is working for you or not, just use wrong URL in main WebSocket URL
		setTimeout(function () {
			ws_url = main_url;
			funcs.socket_connection();
		}, 10 * 60 * 1000); // minute * seconds * 1000
	},
	data_received: prices_data => {
		//console.log(prices_data);
		var key = prices_data['s']; // get currency key name e.g: EUR-USD
		key = key.replace("/", "-");
		prices_data.v = prices_data.v ? prices_data.v : "-"
		// Set prices
		row_keys.forEach(item => {
			gid(`${key}_${item}`, prices_data[item]);
		});
		try {
			var element = document.getElementById(key + "_TIME");
			element.innerHTML = new Date().toLocaleTimeString();
			element.classList.add("time_update");
			setTimeout(() => {
				element.classList.remove("time_update");
			}, 400);
		} catch (error) {
			console.log(key + "_TIME");
		}
	},
	successfully: message => {
		console.log("Connect successfully at " + new Date().toLocaleString());
		gid("status", "Response From Server : " + message);
		gid('error', '');
		// auto re-connection destroy, when we connect with server
		if (socket_re_conn !== undefined)
			clearTimeout(socket_re_conn);
	},
	disconnect: message => {
		console.log("FCS SOCKET: " + message);
		gid("status", "Response From Server: " + message)
		gid('error', '');
		// If your network is down, or in any case, if you disconnect with server then you will auto re-connect
		funcs.socket_re_connection();
		angular.element(document.getElementById('body')).scope().show = false
	},
	message: message => {
		// any log message from server will received here.
		console.log("FCS SOCKET: " + message);
	},
	connect_error: () => {
		funcs.backup_server(); // conenct with backup server
		gid('error', 'Connection error. If you see this message for more then 15 minutes then contact us.');
		angular.element(document.getElementById('body')).scope().show = false
	},
	socket_connection: () => {// start socket connection function
		// if connection recall, then destroy old if exist. 
		if (socket !== undefined) {
			socket.disconnect();
			socket.destroy();
		}

		gid("status", "Connection Request send. Waiting response");

		// require connect with fxpricing
		socket = io.connect(ws_url, {
			transports: ['websocket'],
			path: "/v3/"
		});

		// socket heartbeat require once every hour, if your heartbeat stop so you will disconnect
		socket.emit('heartbeat', api_key);

		// connect your required IDs with server
		socket.emit('real_time_join', currency_ids);
		//funcs
		[
			'data_received',// PRICES Real time data received  from server
			'successfully',// real time join on successfully message return
			'disconnect',// disconnect reason message return
			'message',//message	
			'connect_error'	// if connection error then connect with backup.
		].forEach(item => {
			socket.on(item, funcs[item]);
		});

		// ## heartbeat every hour ##
		/* 
			You need to connect with server once per 24 hour, else your connection will be disconnect.
			Below we set heartbeat every hour, you can increase time upto 24 hours, 
			but do not decrease this time, beucase it will slow down your speed with server
		*/
		if (heart_interval !== undefined)
			clearTimeout(heart_interval);

		heart_interval = setInterval(function () {
			socket.emit('heartbeat', api_key);
		}, (1 * 60 * 60 * 1000)); // hour * minutes*seconds*1000; 

		// ## heartbeat every hour END ##
	},
	socket_re_connection: () => {
		/* Reconnect if socket disconnect. 
			Note: You don't need to decrease re-connect time in setTimeout.
			in case of any socket failure, Socket has its own auto reconnect functionality, so it will quick reconnect with server.
			Below function is extra security, if socket auto reconnect fail, then this function will do its work.
		*/

		if (socket_re_conn !== undefined)
			clearTimeout(socket_re_conn);

		// keep trying reconnect until connect successfully
		// reconnect after every 15 minute
		socket_re_conn = setTimeout(function () {
			funcs.socket_connection();
			funcs.socket_re_connection();
		}, (15 * 60 * 1000));  // minute * seconds * 1000
	},
	start_conn: () => {
		$(".wait").text("waiting...");
	},
	disconnect: () => {/* Call this Function when you want to disconnect */
		if (socket || socket.disconnected)
			return gid("status", "You are not connected with Server");
		socket.disconnect();
		socket.destroy();
	}
}
