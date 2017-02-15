var UTIL = {
	/*
	Makes an array of numbers from s to e.
	Obs.: can't handle e < s
	*/
	range: function(s,e){
		return Array.apply(s, Array(e-s)).map(function(d,i) { return i+s; });
	}
}