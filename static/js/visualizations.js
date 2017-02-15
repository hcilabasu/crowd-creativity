VISUALIZATIONS = {
	/*
	This function builds the core of the versioning panel

	Params:
	* structure: the level and connection structure from the server
	*/
	buildVersioningPanel: function(structure){
		// TODO: this would probably be done better in the server
		var maxIdeasPerLevel = -1;
		for (var i = 0; i < structure.length; i++){
			maxIdeasPerLevel = maxIdeasPerLevel < structure[i].length ? structure[i].length : maxIdeasPerLevel;
		}

		// Setup dimensions, etc.
		var margin = {top: 20, right: 20, bottom: 20, left: 30},
			numLevels = structure.length,
			levelWidth = 60,
			width = levelWidth * numLevels + margin.left + margin.right,
			levelHeight = 30,
			height = levelHeight * maxIdeasPerLevel + margin.top + margin.bottom,
			smallIdeaHeight = 15, // TODO calculate this from max number of ideas on any level
			labelHeight = 20, // TODO figure out a better way to fit the labels on top of the chart e.g. DO A HEIGHTS DICT THAT HAS ALL HEIGHTS
			ideaMap = {}, // Used to store the x,y coordinates of every idea
			ideasElements = [] // Used to store the idea SVG elements for be added after the lines
		// Generic line function, used to draw lines
		var lineFunction = d3.line()
				.x(function(d){return d.x;})
				.y(function(d){return d.y;})

		// Create scale for distribution of level bands
		var levelScale = d3.scaleBand() // Replaces scale.ordinal and rangeRoundPoints
			.domain(UTIL.range(0,numLevels))
			.range([0, width])
			.paddingInner(0)
			.paddingOuter(0);

		var scales = []
		// Create scale for each level
		structure.forEach(function(d,i){
			scales.push(
				d3.scalePoint()
					.domain(UTIL.range(0,d.length))
					.range([0,height]));
		});
		
		// Add main container
		var chart = d3.select('#versioningContainer svg')
			.attr('width', width + margin.left)
			.attr('height', height + margin.top + margin.bottom + 200)
			.append('g')
				.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

		// Create containers
		var axisLabels = chart.append('g')
			.attr('class', 'axisLabels');
		var axesContainer = chart.append('g')
			.attr('transform', 'translate(0, ' + labelHeight + ')');

		// Add elements
		for (var i = 0; i < structure.length; i++){
			// Add labels
			axisLabels.append('text')
				.attr("text-anchor", "middle")
				.text('Level ' + (i+1))
				.attr('y', 0)
				.attr('x', levelScale(i));

			// Add axis lines
			var lineData = [
				{x: levelScale(i), y: 0 },
				{x: levelScale(i), y: height}];
			axesContainer.append('path')
				.attr('d', lineFunction(lineData))
				.attr('class', 'axis');
			
			// Add connections and build ideas array
			for (var j = 0; j < structure[i].length; j++){
				// Setup
				var ideaId = structure[i][j].id;
				var connections = structure[i][j].connection.ids;
				var connectionType = structure[i][j].connection.type;
				var ideaPosition = {
					x: levelScale(i) - smallIdeaHeight / 2, 
					y: scales[i](j) - smallIdeaHeight / 2
				};
				ideaMap[ideaId] = ideaPosition;

				// Add lines
				connections.forEach(function(d){
					// Set positions
					var offset = smallIdeaHeight / 2;
					var lineData = [
						{x: ideaPosition.x + offset, y: ideaPosition.y + offset },
						{x: ideaMap[d].x + offset, y: ideaMap[d].y + offset }];
					// Add it
					axesContainer.append('path')
						.attr('d', lineFunction(lineData))
						.attr('class', 'versioningConnection ' + connectionType);
				});

				// Add idea blocks
				var rect = d3.select(document.createElementNS("http://www.w3.org/2000/svg", "rect"))
					.attr('class', 'smallIdea ideaContainer hover id' + ideaId)
					.attr('height', smallIdeaHeight)
					.attr('width', smallIdeaHeight)
					.attr('transform', function(f,k){ 
						return 'translate(' + ideaPosition.x + ',' + ideaPosition.y + ')'; 
					});
				ideasElements.push(rect);
			}
		}
		// Add ideas
		ideasElements.forEach(function(d){
			axesContainer.append(function(){
				return d.node();
			});
		});
	}
}