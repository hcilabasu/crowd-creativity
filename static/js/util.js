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
	}
};