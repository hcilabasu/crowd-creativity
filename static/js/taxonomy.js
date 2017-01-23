// value of the property has to match python function name
PROCESSING_FUNCTIONS = { 
	'First letter':'first_letter', 
	'Lev. Distance':'lev_distance'
};

$(function(){

	// Initialize interface
	addOptions();
	retrieveMatrixData();

	// Add event handlers
	// $("#time_range").change(retrieveMatrixData);
	$("input[name=options]").change(retrieveMatrixData);

})

var retrieveMatrixData = function(){
	// Get options
	var options = $("input[name=options]:checked").map(function () {
	  return this.value;
	}).get();

	// Get range
	value = $("#time_range").val();

	// Change to visual loading state
	$('#matrix').css('opacity', 0.5);

	$.ajax({
		url: URL.getTagsByMinute,
		data: {minute: value, options:options},
		success: function(data){
			data = JSON.parse(data)
			var raw_number = parseInt(data.len_raw_tags);
			var processed_number = parseInt(data.len_processed_tags);

			$("#raw_number").text(raw_number);
			$("#processed_number").text(processed_number);
			$("#percent_reduced").text((1 - processed_number / raw_number) * 100)
			
			// Update matrix
			updateMatrix(data);

			// Restore matrix' opacity
			$('#matrix').css('opacity', 1);
		}
	})
};

var addOptions = function(){
	var addOption = function(prop){
		// Create elements
		var li = $("<li/>");
		var label = $("<label/>");
		var input = $("<input/>");

		// set elements
		input.attr("type", "checkbox");
		input.attr("name", "options");
		// input.attr("checked", true);
		input.attr("value", PROCESSING_FUNCTIONS[prop]);
		label.text(prop);

		// Add elements
		label.prepend(input);
		li.append(label);
		$("#options-list").append(li);
	};

	for(var prop in PROCESSING_FUNCTIONS){
		addOption(prop);
	}
	
};

var updateMatrix = function(data){
	var showAllLabels = true;
	var matrix = $("#matrix");
	var numCategories = data.tags.length

	matrix.empty();

	for(var i = 0; i < numCategories + 1; i++){
		var row = $("<tr></tr>");
		matrix.append(row);
		for(var j = 0; j < numCategories + 1; j++){
			// Append cell
			if(i == 0){
				if(j == 0){
					// This is the useless first cell
					row.append("<th></th>");
				} else {
					var cat = data.tags[j-1];
					row.append("<th id=\"col-" + "dummy" /*data.ids[j-1]*/ + "\"><div><span>" + cat + "</span></div></th>");
				}
			} else if(j == 0){
				var cat = data.tags[i-1];
				row.append("<th id=\"row-" + "dummy" /*data.ids[i-1]*/ + "\">" +  cat + "</th>")
			} else {
				//var count = data.matrix[i-1][j-1];
				var color = 255; //(255-(count * 15)) < 0 ? 0 : (255-(count * 15))
				row.append("<td style=\"background: rgb(" + color + "," + color + ",255)\"></td>");
			}
		}
	}
};
