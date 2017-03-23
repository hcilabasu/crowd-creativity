var EVENTS = {popOverClose: []},
	TEMPLATES = {},
	VIEWS = {};

$(function(){
	// Setup constants
	ENV.autoReloadTimer = 15; // seconds or 'OFF' to disable
	
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
	ENV.tagConfig = {
		delimiter: [',', ' ', ';'], // Doesn't seem like I can set the UI delimiters separate from the backend. If you change this, change cleanup on the submit function
		height: 'auto',
		width: '100%'
	};
	ENV.tagsDelimiter = ',, ,;';
	$('#addIdea input[name=tagInput]').tagsInput(ENV.tagConfig);
	$('#combineIdeas input[name=combinedTagInput]').tagsInput(ENV.tagConfig);

	// Load windowed layout
	LAYOUT.init();

	// Load panels on page load
	VIEWS['ideasView'] = new IdeaViewerView('#ideasContainer').load();
	VIEWS['versioningView'] = new VersioningView('#versioningContainer').load();
	VIEWS['tasksView'] = new TasksView('#suggestedTasksList').load(); 
	VIEWS['solutionSpaceView'] = new SolutionSpaceView('#solutionSpaceContainer').load();
	
	// Start auto-refresh timers. Uncomment if auto timer should be the default behavior.
	// toggleVersioningTimer();
	// toggleTasksTimer();
	// toggleSolutionSpaceTimer();
});

/* Toolbar button handlers */
var TOOLBAR = {
	ideaViewer: {
		reload: function(){
			VIEWS.ideasView.load();
		}
	},
	versioningView: {
		reload: function(){
			VIEWS.versioningView.load();
		},
		toggleAutoReload: function(){
			UTIL.toggleTimer($('#versioningTimerDisplay'), ()=>VIEWS.versioningView.load());
		}
	},
	suggestedTasks: {
		reload: function(){
			VIEWS.tasksView.load();
		},
		toggleAutoReload: function(){
			UTIL.toggleTimer($('#tasksTimerDisplay'), ()=>VIEWS.tasksView.load());
		}
	},
	solutionSpaceView: {
		reload: function(){
			VIEWS.solutionSpaceView.load();
		},
		toggleAutoReload: function(){
			UTIL.toggleTimer($('#solutionSpaceTimerDisplay'), ()=>VIEWS.solutionSpaceView.load());
		}
	}
}; 

var submitNewIdea = function(event){
	// Get values
	var idea = $('#addIdea textarea').val();
	var tags = $('#addIdea input').val().split(ENV.tagsDelimiter); // This weird pattern is based on the tag plugin's output. Change it if delimiter param is changed at setup.
	// Submit
	submitIdea(idea, tags, 'original', [], function(data){
		var _id = JSON.parse(data).id;
		var _idea = idea;
		var _tags = tags;
    	// Add to UI
		VIEWS.ideasView.addIdeaToDisplay({idea:_idea, id:_id, tags:_tags});
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
	var tags = $('#combineIdeas input[name=combinedTagInput]').val().split(',');
	var sources = JSON.parse($('#combineIdeas input[name=combinedIdeaIds]').val());
	submitIdea(idea, tags, type, sources, function(data){
		var _id = JSON.parse(data).id;
		var _idea = idea;
		var _type = type;
		var _sources = sources;
		var _tags = tags;
		// If idea is merged, remove previous two and add merged. Otherwise, add new idea
		if (type == 'merge'){
			// Remove two ideas
			for(var i = 0; i < _sources.length; i++){
				$('#id' + _sources[i]).remove();
			}
		}
		// Add idea
		VIEWS.ideasView.addIdeaToDisplay({idea:_idea, id:_id, tags:_tags});
		// Close overlay
		closeOverlay();
	});
};

var submitIdea = function(idea, tag, origin, sources, successCallback){
	// Send to server
    $.ajax({
        type: "POST",
        url: URL.addIdea,
        data: {
            "idea": idea,
            "tags": tag,
            "origin": origin,
            "sources": sources
        },
        success: successCallback
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
	    		VIEWS.ideasView.addIdeaToDisplay(idea);
	        }
	    });
	}
};

var openIdeaPopup = function(event){
	openOverlay('addIdea');
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
	tags = []
	$('#combineIdeas .ideaBlock').each(function(index){
		$(this).text(params['ideas'][index]['idea']);
		ids.push(params['ideas'][index]['id']);
		tags = tags.concat(params['ideas'][index]['tags']);
	});
	// Set the values
	$('#combineIdeas input[name=combinedIdeaIds]').val(JSON.stringify(ids));
	$('#combineIdeas input[name=combinedTagInput]').importTags(tags.join(ENV.tagsDelimiter));

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

var tagsViewSetup = function(params){
	var templateParams = {
		category1: params.tags[0],
		category2: params.tags[1]
	};
	$('#tagsView').html(Mustache.render(TEMPLATES.tagsViewTemplate, templateParams));

	var addIdeasToContainer = function(container, ideas){
		ideas.forEach(function(d,i){
			var li = $('<li></li>');
			var ideaElement = new IdeaViewerView(d, {closeable:false, draggable:true, resizable: false, focuseable: false});
			var ideaBlock = ideaElement.html();
			li.html(ideaBlock);
			container.append(li);
			ideaBlock.fadeIn('fast');
		});
	}

	// Load ideas for each category
	params.tags.forEach(function(d,i){
		$.ajax({
			type: "GET",
			url: URL.getIdeasPerCategory,
			data: {tag: d},
			success: function(data){
				var ideas = JSON.parse(data);
				addIdeasToContainer($('#tagsView .' + d + ' ul'), ideas);
			}
		});
	});
}

var addIdeaSetup = function(){
	$('#addIdea textarea').focus();
}