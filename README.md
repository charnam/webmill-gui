# Webmill
This is a graphical web application for controlling a treadmill (specifically, the PitPat line of treadmills) with a web browser, over Web Bluetooth.

## How do I use the web interface?
1. Ensure your browser supports Web Bluetooth
    - Currently supported browsers include modern versions of Google Chrome, Chromium, and Brave
    - **You will need to visit `chrome://flags` and enable Web Bluetooth to connect to your treadmill.**
3. Clone this repository using `git clone`
4. Run an HTTP server at the root. You can `cd` into the newly-cloned directory, and run `python3 -m http.server` to start a basic HTTP server.
5. Visit `localhost` via whichever port was specified by your HTTP server.

## How do I use the JavaScript library?
The file under `Treadmill.js` contains a clean, developer-friendly JavaScript library for interacting with the treadmill.
If you have the need to create another web application which communicates directly with PitPat treadmills, then you will find this file of good use.

```js
import Treadmill from "./path/to/Treadmill.js"

const autoconnect = true;
const treadmill = new Treadmill(autoconnect);

// If you are connecting with a web browser, you will need to wait for user input
connectButton.onclick = () => {
  if(!treadmill.connected && !treadmill.connecting) {
    treadmill.connect();
  }

}
// !! IMPORTANT !!
// Any action run directly after another will overwrite the previous one!
// Running treadmill.stop, immediately followed by treadmill.setSpeedKph, will NOT stop the treadmill.
// Wait until you receive another statechange event before sending another action request.

// All actions below will only occur after the treadmill has sent its "heartbeat" packet.

treadmill.stop(); // End an exercise and reset the treadmill's state

treadmill.start(); // Start or resume an exercise

treadmill.pause(); // Pause any ongoing exercise

treadmill.setSpeedMph(2.2); // 2.2 miles per hour

treadmill.setSpeedKph(3.4); // 3.4 kilometers per hour

// When the treadmill advertises new state data, this code will be executed
treadmill.onstatechange = () => {
  console.log(treadmill.state);
  /**
   * {
   *     "speedMph": 2.10,
   *     "speedKph": 3.40,
   *     "distanceMi": 1.00,
   *     "distanceKm": 1.61,
   *     "kilocalories": 50, - calories burned
   *     "steps": 0, - this value will remain at '0' on some units :(
   *     "duration": 0 - seconds since the exercise started
   * }
   */

  // The treadmill's current mode, makes use of an enum
  switch(treadmill.mode) {
    case Treadmill.MODE_STOPPED:
      // Treadmill has no current exercise data
      break;
    case Treadmill.MODE_RUNNING:
      // Treadmill is currently on, and running
      break;
    case Treadmill.MODE_PAUSED:
      // Treadmill's ongoing exercise has been paused
      break;
    case Treadmill.MODE_STARTING:
      // Treadmill is currently counting down to start
      break;
    case Treadmill.MODE_DISCONNECTED:
      // Treadmill is currently disconnected from Bluetooth
      break;
  }
}



```

If you are making use of this library, please remember to adhere to this project's license, and license your project under a compatible license as well.

## License
Licensed under the GNU Affero General Public License, version 3.0 or later. You may reuse this code, so long as any greater work making use of it also
distributes its publically-available source code under a compatible license.
