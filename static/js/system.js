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

	// Setup popover closure
	$(document).click(closePopovers);

	// Load windowed layout
	LAYOUT.init();

	// Load panels on page load
	loadUserIdeas();
	loadVersioningPanel();
	loadSuggestedTasks();
	loadSolutionSpace();
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
		// If idea is merged, remove previous two and add merged. Otherwise, add new idea
		if (type == 'merge'){
			// Remove two ideas
			for(var i = 0; i < _sources.length; i++){
				$('#id' + _sources[i]).remove();
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
	$('#id'+id).hide(200, function(){ remove(); });
}

var loadIdea = function(id){
	if($('#id' + id).length){
		// Idea is already in pane. Focus
		$('#id' + id).addClass('glow').delay(3000).queue(function(next){ $(this).removeClass('glow'); next(); });
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
	// Load template
	var ideaParameters = {id:idea.id, idea:idea.idea, categories:idea.categories, closeable:params['closeable']};
	var ideaBlock = $(Mustache.render(TEMPLATES.ideaBlockTemplate, ideaParameters));

	// Drag and drop
	if(typeof params['draggable'] == 'boolean' && params['draggable']){
		ideaBlock.draggable({ 
			containment: "parent", 
			scroll: true,
			revert: true,
			start: function(event, ui){
				$(this).css('z-index', 9999);
			},
			stop: function(event, ui){
				$(this).css('z-index', 1);
			}
		}).droppable({
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
	// $('#solutionSpaceContainer').empty();
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
	// $('#solutionSpaceContainer').html('In development...');
	var container = $('#solutionSpaceContainer');
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