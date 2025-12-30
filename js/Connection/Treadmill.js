
// I thank everyone involved in reverse-engineering Bluetooth protocols. Thanks to you, this application gets to exist.
// All Bluetooth communication code is heavily based on https://github.com/KeiranY/PitPat-WebBT

const DEBUG = false;

class Treadmill {
	// >> Static
	static MODE_STARTING = 0;
	static MODE_RUNNING = 1;
	static MODE_PAUSED = 2;
	static MODE_STOPPED = 3;
	static MODE_DISCONNECTED = -1;
	
	static DEFAULT_STATE = {
		speedKph: 0.00,
		speedMph: 0.00,
		distanceKm: 0.00,
		distanceMi: 0.00,
		kilocalories: 0,
		steps: 0,
		duration: 0.00,
		_raw: {}
	};
	
	// --- Bluetooth UUIDs ---
	static SERVICE_UUID = "0000fba0-0000-1000-8000-00805f9b34fb";
	static WRITE_CHAR_UUID = "0000fba1-0000-1000-8000-00805f9b34fb";
	static NOTIFY_CHAR_UUID = "0000fba2-0000-1000-8000-00805f9b34fb";
	
	// >> Object
	connected = false;
	connecting = false;
	connectedDevice = null;
	
	mode = Treadmill.MODE_DISCONNECTED;
	state = Treadmill.DEFAULT_STATE;
	
	// --- BLE ---
	GATTServer = null;
	writeCharacteristic = null;
	notifyCharacteristic = null;
	
	queuedData = null; // Queued data is sent on heartbeat receive
	
	constructor(autoconnect = true) {
		if(autoconnect) {
			this.connect();
		}
	}
	
	start() {
		this._sendData(Treadmill._makePacket("start"));
	}
	stop() {
		this._sendData(Treadmill._makePacket("stop"));
	}
	pause() {
		this._sendData(Treadmill._makePacket("pause"));
	}
	setSpeedKph(kph) {
		this._sendData(Treadmill._makePacket("set_speed", kph * 1000));
	}
	setSpeedMph(mph) {
		this._sendData(Treadmill._makePacket("set_speed", Math.round(mph * 1000 / 0.625)));
	}
	
	_debugLog(...args) {
		if(DEBUG) console.log("[DEBUG] ", ...args);
	}
	
	_setStatus(status) {
		this._debugLog("Status change: "+status);
	}
	
	_sendData(data) {
		// Sends data upon next heartbeat
		this.queuedData = data;
	}
	
	_emitStateUpdate() {
		if(this.onstatechange) {
			this.onstatechange(this);
		}
		this._debugLog("State update: ", this.state);
		this._debugLog("Mode update? " + this.mode);
	}
	
	_disconnected() {
		this.connected = false;
		this._emitStateUpdate();
	}
	
	_handleNotification(event) {
		const notification = event.target.value;
		
		// Logging for debugging
		this._debugLog("Received notification, byteLength:", notification.byteLength);
		
		let hexStr = [];
		for (let i = 0; i < notification.byteLength; ++i) {
			hexStr.push(notification.getUint8(i).toString(16).padStart(2, "0"));
		}
		this._debugLog("Payload (hex):", hexStr.join(" "));
		
		// Parse treadmill data from value
		if (notification.byteLength < 31) {
			this.state = Treadmill.DEFAULT_STATE;
			return;
		}
		// Helper to read unsigned int from bytes
		function u16(offset) {
			return (notification.getUint8(offset) << 8) | notification.getUint8(offset + 1);
		}
		function u32(offset) {
			return (notification.getUint8(offset) << 24) | (notification.getUint8(offset + 1) << 16) | (notification.getUint8(offset + 2) << 8) | notification.getUint8(offset + 3);
		}
		// Parse fields
		const current_speed = u16(3);
		let distance = u32(7);
		let calories = (notification.getUint8(18) << 8) | notification.getUint8(19);
		let steps = u32(14);
		let duration = u32(20);
		
		const flags = notification.getUint8(26);
		
		// 1 for mph output default, 0 for kph output default
		// I've chosen not to use this value. It doesn't really affect anything and can't be modified.
		const unit_mode = (flags & 128) === 128 ? 1 : 0;
		
		const running_state_bits = flags & 24;
		
		if (running_state_bits === 24) this.mode = Treadmill.MODE_STARTING;
		else if (running_state_bits === 8) this.mode = Treadmill.MODE_RUNNING;
		else if (running_state_bits === 16) this.mode = Treadmill.MODE_PAUSED;
		else this.mode = Treadmill.MODE_STOPPED;
		
		// This can be removed if you want more data from your treadmill, even while stopped.
		// I've seen the treadmill fail to provide zeros for certain values when stopped, at random, so this is here to counteract that.
		if(this.mode == Treadmill.MODE_STOPPED) {
			distance = 0;
			calories = 0;
			steps = 0;
			duration = 0;
		}
		
		this.state = {
			speedKph: (current_speed / 1000),
			speedMph: (current_speed / 1000 * 0.625),
			distanceKm: (distance / 1000),
			distanceMi: (distance / 1000 * 0.625),
			kilocalories: calories, // kcal
			steps,
			duration: Math.round(duration / 1000),
			_raw: { current_speed, distance, calories, steps, duration, imperial_unit_default: unit_mode }
		};
		
		// Log parsed fields
		this._debugLog("Parsed treadmill data:", this.state);

		// --- Heartbeat/data send logic, like _notification_handler ---
		if (this.writeCharacteristic) {
			if (this.queuedData) {
				this._debugLog("Sending pending data packet:", Array.from(this.queuedData).map(b => b.toString(16).padStart(2, "0")).join(" "));
				this.writeCharacteristic.writeValue(this.queuedData).then(() => {
					this._debugLog("Pending data sent.");
					this.queuedData = null;
				}).catch(err => {
					console.error("Failed to send pending data:", err);
				});
			} else {
				// Heartbeat packet: 6a05fdf843
				const heartbeat = new Uint8Array([0x6a, 0x05, 0xfd, 0xf8, 0x43]);
				this._debugLog("Sending heartbeat packet:", Array.from(heartbeat).map(b => b.toString(16).padStart(2, "0")).join(" "));
				this.writeCharacteristic.writeValue(heartbeat).then(() => {
					this._debugLog("Heartbeat sent.");
				}).catch(err => {
					console.error("Failed to send heartbeat:", err);
				});
			}
		}

		this._emitStateUpdate();
	}
	
	async connect() {
		if(this.connecting || this.connected) return false;
		
		// --- Bluetooth Logic ---
		this._setStatus('Connecting');
		this.connecting = true;
		try {
			this.connectedDevice = await navigator.bluetooth.requestDevice({
				filters: [{ services: [Treadmill.SERVICE_UUID] }],
				services: [Treadmill.SERVICE_UUID]
			});
			this.connectedDevice.addEventListener('gattserverdisconnected', () => {this._disconnected()});
			this.GATTServer = await this.connectedDevice.gatt.connect();
			this._debugLog("GATT server connected:", this.GATTServer);
			let services = await this.GATTServer.getPrimaryServices();
			this._debugLog("Primary services:", services.map(s => s.uuid));
			this.notifyCharacteristic = await this.GATTServer.getPrimaryService(Treadmill.SERVICE_UUID).then(
				service => service.getCharacteristic(Treadmill.NOTIFY_CHAR_UUID)
			).catch(async () => {
				// fallback: try to find the service by iterating
				let services = await this.GATTServer.getPrimaryServices();
				for (let s of services) {
					try {
						let c = await s.getCharacteristic(Treadmill.NOTIFY_CHAR_UUID);
						if (c) return c;
					} catch {}
				}
				throw new Error("Notify characteristic not found");
			});
			this._debugLog("Notify characteristic:", this.notifyCharacteristic);
			this.writeCharacteristic = await this.GATTServer.getPrimaryService(Treadmill.SERVICE_UUID).then(
				service => service.getCharacteristic(Treadmill.WRITE_CHAR_UUID)
			).catch(async () => {
				let services = await this.GATTServer.getPrimaryServices();
				for (let s of services) {
					try {
						let c = await s.getCharacteristic(Treadmill.WRITE_CHAR_UUID);
						if (c) return c;
					} catch {}
				}
				throw new Error("Write characteristic not found");
			});
			this._debugLog("Write characteristic:", this.writeCharacteristic);
			await this.notifyCharacteristic.startNotifications();
			this.notifyCharacteristic.addEventListener('characteristicvaluechanged', event => this._handleNotification(event));
			this.connected = true;
			this.connecting = false;
			this._setStatus('Stopped');
			this.mode = Treadmill.MODE_STOPPED;
		} catch (err) {
			console.log("[ERROR]  Bluetooth connection error:", err);
			this._setStatus('Disconnected');
			this.connected = false;
			this.connecting = false;
			this.mode = Treadmill.MODE_DISCONNECTED;
		}
	}
	
	
	async _sendCommand(packet) {
		try {
			this._debugLog("Sending command packet:", Array.from(packet).map(b => b.toString(16).padStart(2, "0")).join(" "));
			await this.writeCharacteristic.writeValue(packet);
		} catch (err) {
			console.error("Failed to send command:", err);
		}
	}

	/**
	 * Constructs a treadmill command packet.
	 * @param {string} type - Command type: "start", "pause", "stop", or "set_speed".
	 * @param {number} [speed=1000] - Target speed in treadmill units (integer, 1000 = 1.00 kph, range: 1000 to 6000).
	 * @returns {Uint8Array} The command packet.
	 */
	static _makePacket(type, speed = 1000) {
		// type: "start", "pause", "stop", "set_speed"
		let arr = new Uint8Array(23);
		arr[0] = 0x6A; // START_BYTE
		arr[1] = 0x17; // LENGTH
		// arr[2-5] = 0 (reserved)
		arr[6] = (speed >> 8) & 0xFF;
		arr[7] = speed & 0xFF;
		arr[8] = type === "set_speed" ? 5 : 1; // magical_i11: 5 for set_speed, 1 for others
		arr[9] = 0; // incline
		arr[10] = 80; // weight (default)
		arr[11] = 0; // reserved
		// Command byte (kph): 4=start/set, 2=pause, 0=stop
		let cmd = type === "pause" ? 2 : type === "stop" ? 0 : 4;
		arr[12] = cmd & 0xF7; // kph mode (bit 3 = 0)
		// User ID (8 bytes, default 58965456623)
		let userId = 58965456623n;
		for (let i = 0; i < 8; ++i) {
			arr[13 + i] = Number((userId >> BigInt(56 - i * 8)) & 0xFFn);
		}
		// Checksum: XOR of bytes 1 to 20
		let checksum = 0;
		for (let i = 1; i <= 20; ++i) {
			checksum ^= arr[i];
		}
		arr[21] = checksum;
		arr[22] = 0x43; // END_BYTE
		return arr;
	}
}


export default Treadmill;