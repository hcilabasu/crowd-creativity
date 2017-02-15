var EVENTS = {
	popOverClose: []
}

$(function(){

	// Setup popover closure
	$(document).click(closePopovers);

	// Load panels on page load
	loadUserIdeas();
	loadVersioningPanel();

});

var openIdeaPopup = function(event){
	$('#addIdeaPopup').fadeToggle('fast');
	$('#addIdeaPopup textarea').focus();
	event.stopPropagation();
};

var submitNewIdea = function(event){
	// Get values
	var idea = $('#addIdeaPopup textarea').val();
	var categories = $('#addIdeaPopup input').val().split(',');
	// Submit
	submitIdea(idea, categories, 'original', [], function(data){
		var _id = JSON.parse(data).id;
		var _idea = idea;
    	// Add to UI
		addIdeaToDisplay({idea:_idea, id:_id});
		// Clearing up inputs and giving feedback to the user
		$("#addIdeaPopup input, #addIdeaPopup textarea").val("");
		$("#addIdeaPopup textarea").focus();
		$.web2py.flash("Your idea has been added!", "");
	});
};

var submitCombinedIdea = function(event){
	var idea = $('#combineIdeas textarea').val();
	var type = $('#combineIdeas input[name=combineTypeInput]').val();
	var categories = $('#combineIdeas input[name=combinedCategoryinput]').val().split(',');
	var sources = JSON.parse($('#combineIdeas input[name=combinedIdeaIds]').val());
	submitIdea(idea, categories, type, sources, function(data){
		var _id = JSON.parse(data).id;
		var _idea = idea;
		var _type = type;
		var _sources = sources;
		// If idea is merged, remove previous two and add merged. Otherwise, add new idea
		if (type == 'merge'){
			// Remove two ideas
			for(var i = 0; i < _sources.length; i++){
				$('#idea_' + _sources[i]).remove();
			}
		}
		// Add idea
		addIdeaToDisplay({idea:_idea, id:_id});
		// Close overlay
		closeOverlay();
	});
};

var submitIdea = function(idea, category, origin, sources, successCallback){
	// Send to server
    $.ajax({
        type: "POST",
        url: URL.addIdea,
        data: {
            "idea": idea,
            "concepts": category,
            "origin": origin,
            "sources": sources
        },
        success: successCallback
    });
};

var loadUserIdeas = function(){
	$.ajax({
        type: "GET",
        url: URL.getUserIdeas,
        success: function(data){
        	ideas = JSON.parse(data);
        	for (var i = 0; i < ideas.length; i++) {
        		addIdeaToDisplay(ideas[i]);
        	}
        }
    });
};

var loadVersioningPanel = function(){
	$.ajax({
        type: "GET",
        url: URL.getVersioningStructure,
        success: function(data){
        	var structure = JSON.parse(data);
        	buildVersioningPanel(structure);
        }
    });
};

var addIdeaToDisplay = function(idea){
	// TODO add id to p element in the form: idea_[id], where [id] is the ID of the idea
	var ideaBlock = $('<p class="ideaBlock" id="idea_'+idea.id+'" style="display:none"></p>').text(idea.idea)
		.append('<span></span>')
		.append($('<input type="hidden" name="ideaId"></input>').val(idea.id))
		.append($('<input type="hidden" name="ideaCategories"></input>').val(idea.categories));
	$("#ideasContainer").append(ideaBlock);
	ideaBlock.fadeIn('slow');
	// Make it draggable
	ideaBlock.draggable({ 
		containment: "parent", 
		scroll: true,
		revert: "valid",
		start: function(event, ui){
			$(this).css('z-index', 9999);
		},
		stop: function(event, ui){
			$(this).css('z-index', 1);
		}
	});
	// Make it droppable
	ideaBlock.droppable({
		drop: function(event, ui){
			var idea1Element = ui.draggable;
			var idea2Element = $(this);

			var idea1 = {idea: idea1Element.text(), 
						 id: $('input[name=ideaId]', idea1Element).val(),
						 categories: $('input[name=ideaCategories]', idea1Element).val()};
			var idea2 = {idea: idea2Element.text(), 
						 id: $('input[name=ideaId]', idea2Element).val(),
						 categories: $('input[name=ideaCategories]', idea2Element).val()};
			openOverlay('combineIdeas', {ideas: [idea1, idea2]});
		},
		classes: {
			'ui-droppable-hover': 'ideaHover'
		}
	});
};

var buildVersioningPanel = function(structure){

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
				.attr('class', 'smallIdea')
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
	})
}

// Opens up the popup overlay and sets up the popup using the function [popupId]Setup.
var openOverlay = function(popUpId, params){
	$('#overlay').fadeToggle('fast');
	$('#' + popUpId).fadeToggle('fast');
	// Call setup function for the ID
	window[popUpId + 'Setup'](params);
};

var closeOverlay = function(){
	$('#overlay').fadeToggle('fast');
};

var closePopovers = function(event) { 
	// Closes any popovers that are open
    if(!$(event.target).closest('.popupDialog').length) {
        if($('.popupDialog, #overlay').is(':visible')) {
            $('.popupDialog, #overlay').fadeOut('fast', function(){
            	// Fire events
			    while(EVENTS.popOverClose.length > 0){
			    	var handler = EVENTS.popOverClose.pop();
			    	handler();
			    }
            });
        }
    }        
};

var combineIdeasSetup = function(params){
	// Add the idea text to the blocks
	ids = []
	categories = []
	$('#combineIdeas .ideaBlock').each(function(index){
		$(this).text(params['ideas'][index]['idea']);
		ids.push(params['ideas'][index]['id']);
		categories.push(params['ideas'][index]['categories']);
	});
	// Set the values
	$('#combineIdeas input[name=combinedIdeaIds]').val(JSON.stringify(ids));
	$('#combineIdeas input[name=combinedCategoryinput]').val(categories.join(','));

	// Set up tear down function
	EVENTS.popOverClose.push(function(){
		// Empty fields
		$('#combineIdeas input[name=combineTypeInput]').val();
		$('#combineIdeas input[name=ideaIds]').val();
		// Switch back options panel
		$('#combineIdeas .choices').show();
		$('#combineIdeas .ideaInput').hide();
		closeOverlay();
	});
}

var replaceCombineIdeasOptions = function(event, type){
	$('#combineIdeas .choices').hide('fast');
	$('#combineIdeas .ideaInput').show('fast');
	// Sets the text in the paragraph
	$('.combinationType').text(type + 'd');
	$('#combineIdeas input[name=combineTypeInput]').val(type)
};