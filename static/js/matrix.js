var updateMatrix = function(data){
	data = JSON.parse(data);
	// data.matrix (matrix of float numbers)
	// data.categories (array of strings)

	var showAllLabels = true;
	var matrix = $("#matrix");
	var numCategories = data.categories.length

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
					var cat = data.categories[j-1];
					row.append("<th id=\"col-" + data.ids[j-1] + "\"><div><span>" + (DATA.userCategories.has(cat) || showAllLabels ? cat : "&nbsp;") + "</span></div></th>");
				}
			} else if(j == 0){
				var cat = data.categories[i-1];
				row.append("<th id=\"row-" + data.ids[i-1] + "\">" + (DATA.userCategories.has(cat) || showAllLabels ? cat : "&nbsp;") + "</th>")
			} else {
				var count = data.matrix[i-1][j-1];
				var color = (255-(count * 15)) < 0 ? 0 : (255-(count * 15))
				row.append("<td style=\"background: rgb(" + color + "," + color + ",255)\"></td>");
			}
		}
	}

};

var getMatrix = function(){
	$.ajax({
	    type: "POST",
	    url: URL.getMatrix,
	    success: updateMatrix
	});
};

$(function(){

	getMatrix();
	window.setInterval(function(){
		getMatrix();
	}, 5000);

});
