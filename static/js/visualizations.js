VISUALIZATIONS = {
	/* global visualization dimensions */
	dim: {
		smallIdea: 15 // Dimensions of square small idea. Valid for width and height
	},
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
		var ideasArray = []
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
					x: levelScale(i) - VISUALIZATIONS.dim.smallIdea / 2, 
					y: scales[i](j) - VISUALIZATIONS.dim.smallIdea / 2
				};
				ideaMap[ideaId] = ideaPosition;

				// Add lines
				connections.forEach(function(d){
					// Set positions
					var offset = VISUALIZATIONS.dim.smallIdea / 2;
					var lineData = [
						{x: ideaPosition.x + offset, y: ideaPosition.y + offset },
						{x: ideaMap[d].x + offset, y: ideaMap[d].y + offset }];
					// Add it
					axesContainer.append('path')
						.attr('d', lineFunction(lineData))
						.attr('class', 'versioningConnection ' + connectionType);
				});

				// Add idea blocks
				var ideaObject = { id: ideaId, position: ideaPosition }
				ideasArray.push(ideaObject)
			}
		}
		// Add ideas
		axesContainer.selectAll('rect')
			.data(ideasArray)
			.enter()
			.append('rect')
			.attr('class', function(d){ return 'smallIdea ideaContainer hover id' + d.id; })
			.attr('height', VISUALIZATIONS.dim.smallIdea)
			.attr('width', VISUALIZATIONS.dim.smallIdea)
			.attr('x', function(d){ return d.position.x; })
			.attr('y', function(d){ return d.position.y; })
			// Add hover effects
			.on('mouseover', function(d){
				VISUALIZATIONS.focusIdeaInVersioning('id' + d.id);
				// Toggle the idea in the idea panel as well
				UTIL.addClass('.id'+d.id, 'ideaHover');
			}).on('mouseout', function(d){
				VISUALIZATIONS.unfocusIdeaInVersioning('id' + d.id);
				// Toggle the idea in the idea panel as well
				UTIL.removeClass('.id'+d.id, 'ideaHover');
			}).on('click', function(d){
				// Load idea
				loadIdea(d.id);
			});
	},

	focusIdeaInVersioning: function(id){
		var idea = d3.selectAll('#versioningContainer .' + id);
		var position = {x:idea.attr('x'), y:idea.attr('y')};
		idea.classed('smallIdeaHover', true);
		idea.transition()
			.duration(200)
			.attr('width', VISUALIZATIONS.dim.smallIdea + 10)
			.attr('height', VISUALIZATIONS.dim.smallIdea + 10)
			.attr('transform', 'translate(-5,-5)');
	},

	unfocusIdeaInVersioning: function(id){
		var idea = d3.selectAll('#versioningContainer .' + id);
		var position = {x:idea.attr('x'), y:idea.attr('y')};
		idea.classed('smallIdeaHover', false);
		idea.transition()
			.duration(200)
			.attr('width', VISUALIZATIONS.dim.smallIdea)
			.attr('height', VISUALIZATIONS.dim.smallIdea)
			.attr('transform', 'translate(0,0)');
	},

	buildSolutionSpacePanel: function(structure){
		var container = $('#spaceContainer');
		structure.categories.forEach(function(d,i){
			var cell = $('<div></div>').addClass('spCell');
			var stats = $('<div></div>').addClass('spCell');
			cell.append($('<span></span>').text(d.concept));
			$('#solutionSpaceHeader').append(cell);
			$('#solutionSpaceLeftColumn').append(cell.clone());
			$('#solutionSpaceRightColumn').append(stats);

			// Create cells 
			var newRow = $('<div></div>').addClass('spRow');
			container.append(newRow);
			structure.categories.forEach(function(e,j){
				var concepts = [d.concept, e.concept].sort(); // Make it alphabetical
				var cellClass = 'spCell cl_' + (concepts[0] === concepts[1] ? concepts [0] : concepts[0] + ' cl_' + concepts[1]); // If this is the diagonal, add only one class.
				var newCell = $('<div><span></span></div>').addClass(cellClass);
				newRow.append(newCell);
			});
		});

		// Iterate over connections and paint them. TODO possibly optimize by using the previous double loop to already print the cell color
		// ALternatively, kill inner loop above and only print cells that have content
		var maxN = structure.max_n;
		structure.connections.forEach(function(d,i){
			var selector = 'spCell';
			var concepts = d.concepts.sort();
			concepts.forEach(function(e,j){
				selector += ' cl_' + e;
			});
			$('[class="' + selector + '"] span').css('background', 'rgba(102,102,102,' + d.n / maxN + ')');
		});

		// Add interactivity
		$('#spaceContainer .spCell').hover(function(e){
			$(this).addClass('cellHover');
			var position = $(this).index() + 1;
			$('.spRow .spCell:nth-child('+position+')').addClass('cellHover');

			// Get classes to trigger hover
			var classes = $(this).attr('class').split(' ');
			// Remove classes that don't start with cl_
			for(var i = 0; i < classes.length; i++){
				if(!classes[i].startsWith('cl_')){
					classes.splice(i,1);
				} else {
					classes[i] = '.'+classes[i]
				}
			}
			console.dir(classes.join(''));
			UTIL.addClass('#ideasContainer .' + classes.join(''), 'ideaHover');
			
		},function(){
			$(this).removeClass('cellHover');
			var position = $(this).index() + 1;
			$('.spRow .spCell:nth-child('+position+')').removeClass('cellHover');

			// Remove ideahover class
			UTIL.removeClass('.ideaHover', 'ideaHover');
		});
	}
}