class VersioningView extends View {

    constructor(container){
        super(container);

        // Set shared variables
        this.dimensions = {
            smallIdea: 15
        };
    }

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        console.dir('Initializing Versioning View');
        // Clear Panel
		$(this.container).html('<svg></svg>');
		this.getParentContainer().addClass('loading');
        // Load panel
        $.ajax({
            type: "GET",
            url: URL.getVersioningStructure,
            success: (data)=>{
                var structure = JSON.parse(data);
                this.buildVersioningPanel(structure);
            }
        });
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
        console.dir('Custom VERSIONING Highlight idea');
        var id = e.params.id; 
        var idea = d3.selectAll(this.container + ' .id' + id);
		// Hover
		idea.classed('smallIdeaHover', true);
		idea.transition()
			.duration(200)
			.attr('width', this.dimensions.smallIdea + 10)
			.attr('height', this.dimensions.smallIdea + 10)
			.attr('transform', 'translate(-5,-5)');
		// If hovering for over a given threshold of time, scroll down to the idea
		this.hoverTimeout = window.setTimeout(()=>{ // Wait
			var container = $(this.container); // This is the scroll container element
			if(idea.nodes().length > 0){
				var taskBlock = $(idea.nodes()[0]); // This is the task block that will be scrolled to
				var scrollTo = taskBlock.offset().top - container.offset().top + container.scrollTop();
				container.animate({
					scrollTop: scrollTo - 30 // padding
				}, ENV.scrollSpeed);
			}
		}, ENV.scrollDelay);
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        console.dir('Custom VERSIONING Blur idea');
        var id = e.params.id; 
        var idea = d3.selectAll(this.container + ' .id' + id);
		// Remove highlight
		idea.classed('smallIdeaHover', false);
		idea.transition()
			.duration(200)
			.attr('width', this.dimensions.smallIdea)
			.attr('height', this.dimensions.smallIdea)
			.attr('transform', 'translate(0,0)');
		// Clear timeout
		clearTimeout(this.hoverTimeout);
    }

    /*
    Build the visualization
    */
    buildVersioningPanel(structure){
		// TODO: this would probably be done better in the server
		var maxIdeasPerLevel = -1;
		for (var i = 0; i < structure.length; i++){
			maxIdeasPerLevel = maxIdeasPerLevel < structure[i].length ? structure[i].length : maxIdeasPerLevel;
		}

		// Setup dimensions, etc.
		var margin = {top: 20, right: 20, bottom: 20, left: 30},
			numLevels = structure.length,
			levelWidth = 80,
			width = levelWidth * numLevels + margin.left + margin.right,
			levelHeight = 50,
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
		var chart = d3.select(this.container + ' svg')
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
		var ideasArray = [];
		for (var i = 0; i < structure.length; i++){
			// Add labels
			axisLabels.append('text')
				.attr("text-anchor", "middle")
				.text('Iteration ' + (i+1))
				.attr('y', 0)
				.attr('x', levelScale(i) + 20);

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
				var connections = structure[i][j].connection.ids; // Parents
				var connectionType = structure[i][j].connection.type;
				var ideaPosition = 0;
				if (!connections || connections.length === 0){
					// There are no previous connections. Add to next available space 
					ideaPosition = {
						x: levelScale(i) - this.dimensions.smallIdea / 2, 
						y: scales[i](j) - this.dimensions.smallIdea / 2
					};
				} else {
					var midPoint = (ideaMap[connections[0]].y + ideaMap[connections[1]].y) / 2;
					ideaPosition = {
						x: levelScale(i) - this.dimensions.smallIdea / 2, 
						y: midPoint
					};
				}
				// Update ideaMap
				ideaMap[ideaId] = ideaPosition;

				// Add lines
				if(connections && connections.length > 0){
					connections.forEach((d)=>{
						// Set positions
						var offset = this.dimensions.smallIdea / 2;
						var lineData = [
							{x: ideaPosition.x + offset, y: ideaPosition.y + offset },
							{x: ideaMap[d].x + offset, y: ideaMap[d].y + offset }];
						// Add it
						axesContainer.append('path')
							.attr('d', lineFunction(lineData))
							.attr('class', 'versioningConnection ' + connectionType);
					});
				}

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
			.attr('height', this.dimensions.smallIdea)
			.attr('width', this.dimensions.smallIdea)
			.attr('x', function(d){ return d.position.x; })
			.attr('y', function(d){ return d.position.y; })
			// Add hover effects
			.on('mouseover', function(d){
                // Trigger highlight event
				$.event.trigger({type:EVENTS.highlightIdea, params:{id:d.id}});
			}).on('mouseout', function(d){
				// Trigger blur event
                $.event.trigger({type:EVENTS.blurIdea, params:{id:d.id}});
			}).on('click', function(d){
				// TODO Load idea on click
				VIEWS.ideasView.loadIdea(d.id);
			});
	}

};
