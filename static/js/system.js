var EVENTS = {popOverClose: []},
	TEMPLATES = {};

$(function(){
	// Parse templates
	Mustache.tags = ['[[',']]']
	$('script[type$=x-tmpl-mustache]').each(function(i,d){
		var id = $(d).attr('id');
		var html = $('#'+id).html()
		Mustache.parse(html)
		TEMPLATES[id] = html;
	});

	// Close overlay on click
	$('#overlay').click(closeOverlay);

	// Start tag input
	var tagConfig = {
		delimiter: [',', ' ', ';'], // Doesn't seem like I can set the UI delimiters separate from the backend. If you change this, change cleanup on the submit function
		height: 'auto',
		width: '100%'
	};
	ENV.tagsDelimiter = ',, ,;';
	$('#addIdea input[name=categoryinput]').tagsInput(tagConfig);
	$('#combineIdeas input[name=combinedCategoryinput]').tagsInput(tagConfig);

	// Load windowed layout
	LAYOUT.init();

	// Load panels on page load
	loadUserIdeas();
	loadVersioningPanel();
	loadSuggestedTasks();
	loadSolutionSpace();
});

var openIdeaPopup = function(event){
	openOverlay('addIdea');
};

var submitNewIdea = function(event){
	// Get values
	var idea = $('#addIdea textarea').val();
	var categories = $('#addIdea input').val().split(ENV.tagsDelimiter); // This weird pattern is based on the tag plugin's output. Change it if delimiter param is changed at setup.
	// Submit
	submitIdea(idea, categories, 'original', [], function(data){
		var _id = JSON.parse(data).id;
		var _idea = idea;
		var _categories = categories;
    	// Add to UI
		addIdeaToDisplay({idea:_idea, id:_id, categories:_categories});
		// Clearing up inputs and giving feedback to the user
		$("#addIdea input").importTags(''); 
		$("#addIdea textarea").val("");
		$("#addIdea textarea").focus();
		$.web2py.flash("Your idea has been added!", "ok");
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
		var _categories = categories;
		// If idea is merged, remove previous two and add merged. Otherwise, add new idea
		if (type == 'merge'){
			// Remove two ideas
			for(var i = 0; i < _sources.length; i++){
				$('#id' + _sources[i]).remove();
			}
		}
		// Add idea
		addIdeaToDisplay({idea:_idea, id:_id, categories:_categories});
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
	// Clear panel
	$('#ideasContainer').empty();
	// Load ideas
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

var closeIdea = function(id){
	$('#ideasContainer #id'+id).hide(200, function(){ this.remove(); });
}

var loadIdea = function(id){
	if($('#ideasContainer #id' + id).length){
		// Idea is already in pane. Focus
		$('#ideasContainer #id' + id).addClass('glow').delay(3000).queue(function(next){ $(this).removeClass('glow'); next(); });
	} else {
		// Idea is not in the pane. Retrieve and display.
		$.ajax({
	        type: "GET",
	        data: {id:id},
	        url: URL.getIdeaById,
	        success: function(data){
	        	var idea = JSON.parse(data);
	    		addIdeaToDisplay(idea);
	        }
	    });
	}
};

var loadVersioningPanel = function(){
	// Clear Panel
	$('#versioningContainer').html('<svg></svg>');
	// Load panel
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
	var ideaBlock = createIdeaElement(idea, {closeable:true, draggable:true, resizable: true, focuseable: true});
	$("#ideasContainer").append(ideaBlock);
    ideaBlock.fadeIn('slow');
};

var createIdeaElement = function(idea, params){
	var addedBy = idea.userId === ENV.userId ? 'you' : 'someone else';
	// Load template
	var ideaParameters = {id:idea.id, addedBy:addedBy, idea:idea.idea, categories:idea.categories, closeable:params['closeable']};
	var ideaBlock = $(Mustache.render(TEMPLATES.ideaBlockTemplate, ideaParameters));
	if(idea.categories){
		idea.categories.forEach(function(d,i){
			ideaBlock.addClass('cl_' + d);
		});
	}

	// Drag and drop
	if(typeof params['draggable'] == 'boolean' && params['draggable']){
		ideaBlock.draggable({  
			appendTo: "parent",
			helper: "clone",
			revert: true,
			start: function(event, ui){
				event.stopPropagation();
				$(this).css('opacity', 0);
			},
			stop: function(event, ui){
				event.stopPropagation();
				$(this).css('opacity', 1);
			}
		}).droppable({
			drop: function(event, ui){
				var idea1Element = ui.draggable;
				var idea2Element = $(this);

				var idea1 = {idea: idea1Element.text(), 
							id: $('input[name=ideaId]', idea1Element).val(),
							categories: $('input[name=ideaCategories]', idea1Element).val().split(',')};
				var idea2 = {idea: idea2Element.text(), 
							id: $('input[name=ideaId]', idea2Element).val(),
							categories: $('input[name=ideaCategories]', idea2Element).val().split(',')};
				event.stopPropagation();
				openOverlay('combineIdeas', {ideas: [idea1, idea2]});
			},
			classes: {
				'ui-droppable-hover': 'ideaDragHover'
			}
		});
	}
	
	// Resizable
	if(typeof params['resizable'] == 'boolean' && params['resizable']){
		ideaBlock.resizable({
		maxHeight: 200,
		maxWidth: 230,
		minHeight: 100,
		minWidth: 130
		});
	}
	
	// Focuseable
	if(typeof params['focuseable'] == 'boolean' && params['focuseable']){
		ideaBlock.hover(function(){
			var id = $(this).attr('id');
			UTIL.addClass('.' + id, 'ideaHover');
			// Trigger visualizations
			VISUALIZATIONS.focusIdeaInVersioning(id);
		},function(){
			var id = $(this).attr('id');
			UTIL.removeClass('.' + id, 'ideaHover');
			VISUALIZATIONS.unfocusIdeaInVersioning(id);
		});
	}

	return ideaBlock;
};

var buildVersioningPanel = function(structure){
	// Build panel
	VISUALIZATIONS.buildVersioningPanel(structure);
};

var loadSuggestedTasks = function(){
	$('#suggestedTasksList').empty();
	$.ajax({
        type: "GET",
        url: URL.getSuggestedTasks,
        success: function(data){
        	var structure = JSON.parse(data);
        	buildSuggestedTasksPanel(structure);
        }
    });
};

var buildSuggestedTasksPanel = function(structure){
	var tasksList = $('#suggestedTasksList');
	for(var i = 0; i < structure.rating.length; i++){
		var idea = {idea: structure.rating[i].idea, id: structure.rating[i].idea_id};
		var params = {closeable: false, focuseable: true}
		var taskItem = $("<li></li>").html(Mustache.render(TEMPLATES.ratingTaskTemplate, idea));
		$('#ideaPlaceholder', taskItem).replaceWith(createIdeaElement(idea, params));
		$('.ideaBlock', taskItem).css('display', 'block');
		taskItem.css('display','none');
		tasksList.append(taskItem);
		taskItem.fadeIn();
	}
};

var submitRatingTask = function(event){
	var taskContainer = $(event.target).parent('li');
	var ideaBlock = $('.ideaBlock', taskContainer);
	var data = {
		idea_id: $('input[name=ideaId]',ideaBlock).val(),
		originality: $('[name=originality]:checked',taskContainer).val(),
		usefulness: $('[name=usefulness]:checked',taskContainer).val()
	};
	$.ajax({
        type: "POST",
        url: URL.submitRatingTask,
		data: data,
        success: function(data){
			var _container = taskContainer;
			$.web2py.flash('Task successfully submitted!', 'ok');
        	_container.hide(300, function(){
				_container.remove();
			})
        },
		error: function(){
			$.web2py.flash('Something went wrong!', 'error');
		}
    });
};

var loadSolutionSpace = function(){
	$('#solutionSpaceContainer').empty();
	$.ajax({
        type: "GET",
        url: URL.getSolutionSpace,
        success: function(data){
        	var structure = JSON.parse(data);
        	buildSolutionSpacePanel(structure);
        }
    });
};

var buildSolutionSpacePanel = function(structure){
	$('#solutionSpaceContainer').html(Mustache.render(TEMPLATES.solutionSpaceStructureTemplate));
	var container = $('#solutionSpaceContainer');
	// Make sure header columns stay in place
	container.on('scroll resize',function(event){
		$('#solutionSpaceHeader').offset({top:container.offset().top});
		$('#solutionSpaceLeftColumn').offset({left:container.offset().left});
		var rightColumn = $('#solutionSpaceRightColumn');
		rightColumn.offset({left:container.prop("clientWidth") - rightColumn.width()});
	});

	VISUALIZATIONS.buildSolutionSpacePanel(structure);
};


// Opens up the popup overlay and sets up the popup using the function [popupId]Setup.
var openOverlay = function(popUpId, params){
	$('#overlay > div').hide();
	$('#overlay').fadeIn('fast');
	$('#' + popUpId).fadeIn('fast');
	// Call setup function for the ID
	window[popUpId + 'Setup'](params);
};

var closeOverlay = function(event){
	if(!event || $(event.target).is('#overlay')){
		$('#overlay').fadeOut('fast');

		// Call event handlers
		for(var i = 0; i < EVENTS.popOverClose.length; i++){
			var handler = EVENTS.popOverClose.pop();
			handler();
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
		categories = categories.concat(params['ideas'][index]['categories']);
	});
	// Set the values
	$('#combineIdeas input[name=combinedIdeaIds]').val(JSON.stringify(ids));
	$('#combineIdeas input[name=combinedCategoryinput]').importTags(categories.join(ENV.tagsDelimiter));

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

var categoriesViewSetup = function(params){
	var templateParams = {
		category1: params.categories[0],
		category2: params.categories[1]
	};
	$('#categoriesView').html(Mustache.render(TEMPLATES.categoriesViewTemplate, templateParams));

	var addIdeasToContainer = function(container, ideas){
		ideas.forEach(function(d,i){
			var li = $('<li></li>');
			var ideaBlock = createIdeaElement(d, {closeable:false, draggable:true, resizable: false, focuseable: false});
			li.html(ideaBlock);
			container.append(li);
			ideaBlock.fadeIn('fast');
		});
	}

	// Load ideas for each category
	params.categories.forEach(function(d,i){
		$.ajax({
			type: "GET",
			url: URL.getIdeasPerCategory,
			data: {concept: d},
			success: function(data){
				var ideas = JSON.parse(data);
				addIdeasToContainer($('#categoriesView .' + d + ' ul'), ideas);
			}
		});
	});
}

var addIdeaSetup = function(){
	$('#addIdea textarea').focus();
}