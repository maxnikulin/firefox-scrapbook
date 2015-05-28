
let activeTimerMap = {}
let nextTimerId = 0;

function TimerCallback(callback) {
	this.callback = callback;
	do {
		this.id = nextTimerId++;
		nextTimerId = nextTimerId % (1 << 30);
	} while (nextTimerId in activeTimerMap);
}

TimerCallback.prototype.notify = function notify(timer) {
	delete activeTimerMap[this.id];
	this.callback();
};
TimerCallback.prototype.id = null;
TimerCallback.prototype.timer = null;

function setTimeout(callback, timeout) {
	if (!(callback instanceof Function)) {
		return;
	}
	var timer = Components.classes["@mozilla.org/timer;1"]
		.createInstance(Components.interfaces.nsITimer);

	var timerCallback = new TimerCallback(callback);
    timerCallback.timer = timer.initWithCallback(
		timerCallback, timeout, Components.interfaces.nsITimer.TYPE_ONE_SHOT
	);
	activeTimerMap[timerCallback.id] = timerCallback;
	return timerCallback.id;
}

function clearTimeout(id) {
	var timer = activeTimerMap[id];
	if (!timer) {
		return;
	}
	if (timer.timer) {
		timer.timer.cancel();
	}
	delete activeTimerMap[id];
}

function clearAllTimeout() {
	for (var id in activeTimerMap) {
		clearTimeout(id);
	}
}

var EXPORTED_SYMBOLS = ["setTimeout", "clearTimeout", "clearAllTimeout"];
