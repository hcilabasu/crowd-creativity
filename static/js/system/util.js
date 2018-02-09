var UTIL = {
	/*
	Makes an array of numbers from s to e.
	Obs.: can't handle e < s
	*/
	range: function(s,e){
		return Array.apply(s, Array(e-s)).map(function(d,i) { return i+s; });
	},
	/*
	Adds the class for the element with id elementId
	*/
	addClass: function(selector, c){
		$(selector).addClass(c);
	},
	/*
	Removes the class for the element with id elementId
	*/
	removeClass: function(selector, c){
		$(selector).removeClass(c);
	},
	/*
	Gets the classes of the element, and selects only the ones that start with prefix
	*/
	getClasses: function(jqElement, startsWithPrefix){
		var classes = jqElement.attr('class').split(' ');
		var filtered = [];
		// Remove classes that don't start with prefix
		for(var i = 0; i < classes.length; i++){
			if(classes[i].startsWith(startsWithPrefix)){
				// Class starts with prefix. 
				filtered.push('.' + classes[i]);
			}
		}
		return filtered;
	},
	/*
	Starts a timer, displaing the countdown on timerDisplay, and executing endFn at every duration seconds.
	*/
	setTimer: function(timerDisplay, endFn, duration, repeat){
		timerDisplay.text(duration);
		var _duration = duration;
		var interval = window.setInterval(function(){
			var seconds = parseInt(timerDisplay.text());
			if(!isNaN(seconds)) {
				// Display is on. Continue timer from there
				timerDisplay.text(seconds);
				if(seconds <= 0){
					seconds = _duration;
					endFn();
					if(!repeat){
						// Do not repeat. Stop timer
						clearInterval(interval);
					} else {
						timerDisplay.text(_duration);
					}
				} else {
					// Decrease timer
					timerDisplay.text(seconds - 1);
				}
			} else {
				// Display was turned off. Stop interval
				clearInterval(interval);
			}
		}, 1000);
		return interval;
	},
	/*
	Toggles a timer based on the state of its display
	*/
	toggleTimer: function(display, fn){
		if (isNaN(parseInt(display.text()))){
			// It is currently off. Turn it on
			UTIL.setTimer(display, fn, ENV.autoReloadTimer, true);
		} else {
			// It is currently on. Turn it off
			display.text('OFF');
		}	
	},
	/*
	Returns a function, that, as long as it continues to be invoked, will not
	be triggered. The function will be called after it stops being called for
	N milliseconds. If `immediate` is passed, trigger the function on the
	leading edge, instead of the trailing.
	From Underscore.js, taken from https://davidwalsh.name/javascript-debounce-function
	*/
	debounce: function(func, wait, immediate) {
		var timeout;
		return function() {
			var context = this, args = arguments;
			var later = function() {
				timeout = null;
				if (!immediate) func.apply(context, args);
			};
			var callNow = immediate && !timeout;
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
			if (callNow) func.apply(context, args);
		};
	},
	/*
	This function returns a JSON object based on jQuery's form.serializeArray() method
	- formArray: output from serializeArray() method
	- customProcessing: this is a dictionary of processing functions for particular form elements
	*/
	objectifyForm: function(formArray, customProcessing) {
		var returnArray = {};
		for (var i = 0; i < formArray.length; i++){
			var name = formArray[i]['name'];
			var value = formArray[i]['value']
			if (customProcessing && customProcessing[name]){
				value = customProcessing[name](value);
			}
			returnArray[name] = value;
		}
		return returnArray;
	},
	/*
	Inserts an error message after the given element
	*/
	insertErrorMessage: function(element, message, errorId) {
		var messageContainer = $('#' + errorId);
		if(messageContainer.length === 0){
			$(element).first().after(
				$('<label>'+ message +'</label>')
					.attr('id',errorId)
					.addClass('error'));
		} else {
			messageContainer.text(message);
			$('#' + errorId).show();
		}
	}


};