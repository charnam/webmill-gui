import Treadmill from "./Connection/Treadmill.js";

const primaryTreadmill = new Treadmill(false);

const connectButton = document.getElementById("connect-button");
const startStopButton = document.getElementById("start-stop-button");
const endExerciseButton = document.getElementById("end-exercise-button");

const speedEl = document.querySelector("#speed .stat-value");
const distanceEl = document.querySelector("#distance .stat-value");
const caloriesEl = document.querySelector("#calories .stat-value");
const durationEl = document.querySelector("#duration .stat-value");

const speedAdjustmentEl = document.getElementById("speed-adjustment")
const speedAdjustmentAddEl = document.getElementById("speed-increase");
const speedAdjustmentValueEl = document.getElementById("speed-adjustment-value");
const speedAdjustmentSubtractEl = document.getElementById("speed-decrease");

const speedMinimum = 0;
const speedMaximum = 6;

let currentSpeed = 0.00;
let currentSpeedIsChanging = false;
let currentSpeedChangedAt = 0;
let currentSpeedIsClean = true;

let speedChangesBy = 0;

function startAddingSpeed() {
	currentSpeedIsChanging = 1
	speedChangesBy = 0.001;
}
function startSubtractingSpeed() {
	currentSpeedIsChanging = -1
	speedChangesBy = 0.001;
}

function stopChangingSpeed() {
	currentSpeedIsChanging = 0;
	currentSpeedChangedAt = Date.now();
	primaryTreadmill.setSpeedMph(currentSpeed);
	currentSpeedIsClean = false;
}

speedAdjustmentAddEl.addEventListener("mousedown", startAddingSpeed);
speedAdjustmentSubtractEl.addEventListener("mousedown", startSubtractingSpeed);
speedAdjustmentAddEl.addEventListener("mouseup", stopChangingSpeed);
speedAdjustmentSubtractEl.addEventListener("mouseup", stopChangingSpeed);

setInterval(() => {
	speedAdjustmentValueEl.innerHTML = currentSpeed.toFixed(2) + "&nbsp;<sub>mph</sub>";
	if(currentSpeedIsChanging) {
		currentSpeed += currentSpeedIsChanging * speedChangesBy;
		currentSpeed = Math.min(Math.max(speedMinimum, currentSpeed), speedMaximum);
		speedChangesBy *= 1.003;
		speedAdjustmentValueEl.classList.add("changing");
	} else {
		speedAdjustmentValueEl.classList.remove("changing");
	}
	if(currentSpeedIsClean) {
		speedAdjustmentValueEl.classList.remove("updating");
	} else {
		speedAdjustmentValueEl.classList.add("updating");
	}
}, 10)

function secondsToHms(d) {
	d = Number(d);
	let h = Math.floor(d / 3600);
	let m = Math.floor(d % 3600 / 60);
	let s = Math.floor(d % 3600 % 60);

	let hDisplay = String(h).padStart(2, "0") + ":";
	let mDisplay = String(m).padStart(2, "0") + ":";
	let sDisplay = String(s).padStart(2, "0");
	return hDisplay + mDisplay + sDisplay; 
}

function onStateChange() {
	if(primaryTreadmill.connected) {
		document.body.classList.remove("has-not-connected")
		
		startStopButton.innerText = "..."
		startStopButton.classList.remove("green")
		startStopButton.disabled = false;
		
		speedAdjustmentEl.classList.add("disabled");
		
		switch(primaryTreadmill.mode) {
			case Treadmill.MODE_STARTING:
				endExerciseButton.disabled = true;
				startStopButton.disabled = true;
				startStopButton.innerText = "Starting...";
				endExerciseButton.onclick = () => {
					
				}
				startStopButton.onclick = () => {
				}
				break;
			case Treadmill.MODE_STOPPED:
				endExerciseButton.disabled = true;
				
				endExerciseButton.onclick = () => {
					
				}
			case Treadmill.MODE_PAUSED:
				startStopButton.innerText = "Start"
				startStopButton.classList.add("green")
				startStopButton.onclick = () => {
					primaryTreadmill.start();
				}
				break;
			case Treadmill.MODE_RUNNING:
				speedAdjustmentEl.classList.remove("disabled");
				endExerciseButton.disabled = false;
				startStopButton.innerText = "Pause"
				startStopButton.onclick = () => {
					primaryTreadmill.pause();
				}
				endExerciseButton.onclick = () => {
					primaryTreadmill.stop();
				}
				break;
			default:
				console.log("Unknown mode ", primaryTreadmill.mode)
				break;
		}
		
		const speedElOldText = speedEl.innerHTML;
		
		speedEl.innerText = primaryTreadmill.state.speedMph.toFixed(2);
		distanceEl.innerText = primaryTreadmill.state.distanceMi.toFixed(2);
		durationEl.innerText = secondsToHms(primaryTreadmill.state.duration);
		caloriesEl.innerText = primaryTreadmill.state.kilocalories;
		
		speedEl.innerHTML += "&nbsp;<sub>mph</sub>"
		distanceEl.innerHTML += "&nbsp;<sub>miles</sub>"
		caloriesEl.innerHTML += "&nbsp;<sub>kcal</sub>"
		
		const speedElNewText = speedEl.innerHTML;
		
		if(!currentSpeedIsChanging && speedElOldText == speedElNewText && currentSpeedChangedAt < Date.now() - 1500) {
			currentSpeed = primaryTreadmill.state.speedMph;
			currentSpeedIsClean = true;
		}
	} else {
		document.body.classList.add("has-not-connected");
	}
}

primaryTreadmill.onstatechange = onStateChange;

connectButton.onclick = () => {
	primaryTreadmill.connect();
}

// Will attempt to autoconnect through Electron, if autoconnection fails then the user will be prompted to connect manually.
try {
	await primaryTreadmill.connect();
} catch(err) {
	document.body.classList.add("needs-to-connect");
}

