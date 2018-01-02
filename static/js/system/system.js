$(function(){
	// Parse templates
	Mustache.tags = ['[[',']]']
	$('script[type$=x-tmpl-mustache]').each(function(i,d){
		var id = $(d).attr('id');
		var html = $('#'+id).html()
		Mustache.parse(html);
		TEMPLATES[id] = html;
	});

	// Close overlay on click
	$('#overlay').click(closeOverlay);

	// Start tag input
	ENV.tagConfig = {
		delimiter: [',', ' ', ';'], // Doesn't seem like I can set the UI delimiters separate from the backend. If you change this, change cleanup on the submit function
		height: 'auto',
		width: '100%',
		autocomplete_url: URL.getTags,
		onAddTag: function(tag){
			var _this = $(this);
			tagExists(tag, function(tagExists){
				if(!tagExists){
					// Tag does not exist. Update style
					var container = _this.closest('.tagsinput');
					var tagElement = _this.siblings('.tagsinput').children('.tag').last();
					tagElement.addClass('new');
				}
			});
		}
	};
	ENV.tagsDelimiter = ',, ,;';
	$('#addIdea input[name=tags]').tagsInput(ENV.tagConfig);
	$('#combineIdeas input[name=combinedTagInput]').tagsInput(ENV.tagConfig);

	// Load windowed layout
	LAYOUT.init();

	// Load panels on page load
	VIEWS['ideasView'] = new IdeaViewerView('#ideasContainer').load();
	VIEWS['versioningView'] = new VersioningView('#versioningContainer').load();
	VIEWS['tasksView'] = new TasksView('#suggestedTasksContainer').load(); 
	VIEWS['solutionSpaceView'] = new SolutionSpaceView('#solutionSpaceContainer').load();
	
	// Start auto-refresh timers. Uncomment if auto timer should be the default behavior.
	// toggleVersioningTimer();
	// toggleTasksTimer();
	// toggleSolutionSpaceTimer();

	// Start organization ration scale
	startOrganizationRatioScale();

	// Start autosuggest tags behavior
	startTagsSuggestion(
		'#addIdea textarea', 
		'#addIdea .suggestedTags > div', 
		'#addIdea input[name=tags]');

	/* Toolbar button handlers */
	TOOLBAR = {
		ideaViewer: {
			reload: ()=>{
				VIEWS.ideasView.load();
			},
			loadUserIdeas:()=>{
				VIEWS.ideasView.load();
			},
			loadAllIdeas:()=>{
				VIEWS.ideasView.loadIdeasAddedBy();
			},
			addNewIdea:()=>{
				openIdeaPopup();
			}
		},
		versioningView: {
			reload: ()=>{
				VIEWS.versioningView.load();
			},
			toggleAutoReload: ()=>{
				UTIL.toggleTimer($('#versioningTimerDisplay'), ()=>VIEWS.versioningView.load());
			}
		},
		suggestedTasks: {
			reload: ()=>{
				VIEWS.tasksView.load();
			},
			toggleAutoReload: ()=>{
				UTIL.toggleTimer($('#tasksTimerDisplay'), ()=>VIEWS.tasksView.load());
			}
		},
		solutionSpaceView: {
			reload: ()=>{
				VIEWS.solutionSpaceView.load();
			},
			toggleAutoReload: ()=>{
				UTIL.toggleTimer($('#solutionSpaceTimerDisplay'), ()=>VIEWS.solutionSpaceView.load());
			}
		}
	};

	// If this is a new user, trigger the help menu
	if(ENV.newUser){
		startTutorial();
	}


});

var startOrganizationRatioScale = function(){
	// Attach refresh function to events
	$(document).on([
		EVENTS.ideaSubmitted,
		EVENTS.taskSubmitted
	].join(' '), (e)=>{
		refreshOrganizationRatio();
	});
	// Run first timer
	refreshOrganizationRatio();
	// Start auto update timer
	window.setInterval(()=>refreshOrganizationRatio(), ENV.autoUpdateOrganizationRatioSeconds * 1000);
};

var refreshOrganizationRatio = function(){
	console.dir('Updating organization scale');
	// Refreshes the organization ratio
	$.ajax({
		url: URL.getOrganizationRatio,
		success: (data)=>{
			// Calculate width
			var ratio = parseFloat(data);
			if (ratio >= 0){ 
				var percent = ratio * 100;
				// Calculate color
				// Extremes: low: #DF6464 (223,100,100), high: #3AAAFC (58,170,252)
				var color = function(ratio){
					var low = {r:223,g:100,b:100};
					var high = {r:58,g:170,b:252};
					return [
						parseInt(low.r + (high.r - low.r) * ratio),
						parseInt(low.g + (high.g - low.g) * ratio),
						parseInt(low.b + (high.b - low.b) * ratio)
					]
				}(Math.pow(ratio, 3)); // We want blue to be mostly at the real high end
				// Update scale
				$('#organizationRatio .filling')
					.css('visibility', 'visible')
					.css('width', percent + '%')
					.css('background', 'rgb(' + color.join(',') + ')');
				// Display correct text
				$('#ratioUnavailable').hide();
				$('#ratioAvailable').show();
				// Update percent
				$('#organizationRatioPercentage').text(parseInt(percent));
			} else {
				// There is no data yet
				$('#organizationRatio .filling')
					.css('visibility', 'hidden');
				$('#ratioUnavailable').show();
				$('#ratioAvailable').hide();
			}
		}
	});
};

var submitNewIdea = function(event){
	// Serialize form data
	var formElement = $(event.target).closest('form');
	var form = UTIL.objectifyForm(formElement.serializeArray(), {
		tags: function(value){
			return value.split(ENV.tagsDelimiter);
		}
	});
	// Validate tags. For some reason, the jQuery validator does not pick it up.
	if (form.tags.length < ENV.minNumberTags | !formElement.valid()){ 
		if (form.tags.length < ENV.minNumberTags){
			// Not enough tags. Throw a tantrum. 
			UTIL.insertErrorMessage('#addIdea .tagsinput', 'Insert at least 3 tags', 'errorTags');
		} else {
			// Clean any tags errors
			$('#error-tags').remove();
		}
	} else {
		// Submit
		submitIdea(form.idea, form.tags, 'original', [], function(data){
			var _id = JSON.parse(data).id;
			var _idea = form.idea;
			var _tags = form.tags;
			// Add to UI
			VIEWS.ideasView.addIdeaToDisplay({idea:_idea, id:_id, tags:_tags});
			// Clearing up inputs and giving feedback to the user
			$('#addIdea input').importTags(''); 
			$('#addIdea textarea').val('');
			$('#addIdea textarea').focus();
			$('#addIdea .suggestedTags > div').html('');
			$.web2py.flash('Your idea has been added!', 'ok');
		});
	}
};

var submitCombinedIdea = function(event){
	var idea = $('#combineIdeas textarea').val();
	var type = $('#combineIdeas input[name=combineTypeInput]').val();
	var tags = $('#combineIdeas input[name=combinedTagInput]').val().split(ENV.tagsDelimiter);
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

var submitIdea = function(idea, tags, origin, sources, successCallback){
	// Send to server
    $.ajax({
        type: "POST",
        url: URL.addIdea,
        data: {
            "idea": idea,
            "tags": tags,
            "origin": origin,
            "sources": sources
        },
        success: function(data){
			successCallback(data);
			// Trigger event
			$.event.trigger({type:EVENTS.ideaSubmitted, params:{idea:idea}});
		}
    });
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
			var ideaElement = new Idea(d, {closeable:false, draggable:true, resizable: false, focuseable: false});
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
				addIdeasToContainer($('#tagsView .' + ENV.classPrefix + d + ' ul'), ideas);
			}
		});
	});
}

var addIdeaSetup = function(){
	$('#addIdea textarea').focus();
}

var startTagsSuggestion = function(watchInput, suggestionContainer, tagsInput){
	console.dir('start tags sugg');
	var textarea = $(watchInput);
	var container = $(suggestionContainer);
	var delay = 250;
	var timer = null;

	// Success handler
	var successHandler = function(data){
		container.empty();
		data.forEach(function(d,i){
			// Create element and bind click handler
			var tagElement = $('<span></span>').text(d).addClass('tag');
			tagElement.click(function(){
				// Tag was clicked. Add it to the input.
				tagsInput = $(tagsInput);
				var clickedTag = $(this).text();
				if(!tagsInput.tagExist(clickedTag)){
					tagsInput.addTag(clickedTag);
				}
			});
			// Add to container
			container.append(tagElement);
		});
	};

	// Setup ajax call
	var callback = function(text){
		$.ajax({
			url: URL.getSuggestedTags,
			data: {text:text},
			success: successHandler
		})
	};

	// Bind debounced event to handler
    textarea.on('keypress paste', function() {
        if (timer) {
            window.clearTimeout(timer);
        }
        timer = window.setTimeout( function() {
            timer = null;
            callback(textarea.val());
        }, delay);
    });
};

var startTutorial = function(){
	
	ENV.tutorial = new Tutorial(
		{ // Settings
			
		},
		[ // Steps
			{
				title: 'Welcome',
				html: Mustache.render(TEMPLATES.tutorialWelcomeTemplate)
			},	
			{
				title: 'Idea Viewer',
				highlight: '.stack_IdeaViewerView',
				html: Mustache.render(TEMPLATES.tutorialIdeaViewerTemplate),
				location: {right: 20, top: 0}
			}, 
			{
				title: 'Solution Space',
				highlight: '.stack_SolutionSpaceView',
				html: Mustache.render(TEMPLATES.tutorialSolutionSpaceTemplate),
				location: {right: 20, top: 0}
			},
			{
				title: 'Suggested Tasks',
				highlight: '.stack_TasksView',
				html: Mustache.render(TEMPLATES.tutorialSuggestedTasksTemplate),
				location: {left: 20, top: 0}
			},
			{
				title: 'Organization Level',
				highlight: '#organizationLevel',
				html: Mustache.render(TEMPLATES.tutorialOrganizationLevelTemplate),
				location: {left: -250, bottom: 20}
			}
		]);
	// Start tutorial
	ENV.tutorial.start();
};

var tagExists = function(tag, callback){
	$.ajax({
		url: URL.tagExists,
		data: {tag:tag},
		success: function(exists){
			callback(exists == 'true');
		}
	})
};