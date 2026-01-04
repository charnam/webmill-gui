const { app, BrowserWindow, ipcMain, webFrameMain } = require('electron/main')
const path = require('node:path')

function createWindow () {
	const mainWindow = new BrowserWindow({
		width: 800,
		height: 600,
		fullscreen: true,
		webPreferences: {
			experimentalFeatures: true
		}
	})
	mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
		event.preventDefault()
		const result = deviceList.find((device) => {
			return device.deviceName === 'PitPat-T01' || device.deviceName === "Mindtree-HID";
		})
		if (result) {
			callback(result.deviceId)
		} else {
			// The device wasn't found so we need to either wait longer (eg until the
			// device is turned on) or until the user cancels the request
		}
	})
	
	// We need to simulate a user gesture the moment the page is loaded in order for Web Bluetooth to work without requiring user input.
	mainWindow.webContents.on('did-frame-navigate', (event, url, httpResponseCode, httpStatusText, isMainFrame, frameProcessId, frameRoutingId) => {
		const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
		if(frame)
			frame.executeJavaScript("console.log('hi')", true);
	});
	
	mainWindow.loadFile('index.html');
	
}

app.whenReady().then(() => {
	createWindow()

	app.on('activate', function () {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', function () {
	if (process.platform !== 'darwin') app.quit()
})
