$(function(){
	// Parse templates
	Mustache.tags = ['[[',']]']
	$('script[type$=x-tmpl-mustache]').each(function(i,d){
		var id = $(d).attr('id');
		var html = $('#'+id).html()
		Mustache.parse(html);
		TEMPLATES[id] = html;
	});

	// Make sure validator trims values
	// From: https://stackoverflow.com/questions/1827483/jquery-validate-plugin-how-to-trim-values-before-form-validation
	$.each($.validator.methods, function (key, value) {
        $.validator.methods[key] = function () {           
            if(arguments.length > 0) {
                arguments[0] = $.trim(arguments[0]);
            }
            return value.apply(this, arguments);
        };
    });

	// Define tutorials
	ENV.firstTutorial = new Tutorial(
		{ // Settings
			onclose: function(){
				// When the first tutorial is closed, start the timer
				startViewSequencing();
			}
		},
		[ // Steps
			{
				title: 'Welcome',
				html: Mustache.render(TEMPLATES.tutorialWelcomeTemplate)
			},	
			{
				title: 'Brainstorming topic',
				highlight: '#problem',
				html: '<p>This is the problem you\'re ideating on</p>',
				location: {left: -200, bottom: 20}

			},
			{
				title: 'Add a new Idea',
				highlight: '#newIdeaButton',
				html: Mustache.render(TEMPLATES.tutorialAddIdeaTemplate),
				location: {left: -200, bottom: 20}
			}
		]
	);
	ENV.secondTutorial = new Tutorial(
		{ // Settings
			onclose: function(){
				// Reload other views
				VIEWS.solutionSpaceView.load();
				VIEWS.versioningView.load();
			}
		},
		[ // Steps
			{
				title: 'Solution space view',
				highlight: '.stack_SolutionSpaceView',
				html: Mustache.render(TEMPLATES.tutorialSolutionSpaceTemplate),
				location: {right: 20, top: 0}
			},
			{
				title: 'Versioning view',
				highlight: '.stack_VersioningView',
				html: Mustache.render(TEMPLATES.tutorialVersioningViewTemplate),
				location: {left: 20, top: 0}
			},
			{
				title: 'Inspiration button',
				highlight: '#helpButton',
				html: Mustache.render(TEMPLATES.tutorialInspirationTemplate),
				location: {left: -200, bottom: 20}
			}
		]
	);

	// Enable tooltips
	$( document ).tooltip({
		position: {
			my: 'center top+15',
			at: "center bottom",
			collision: 'flipfit'
		}
	});

	// Close overlay on click
	$('#overlay').click(closeOverlay);

	// Start tag input
	ENV.tagConfig = {
		delimiter: [',', ' ', ';'], // Doesn't seem like I can set the UI delimiters separate from the backend. If you change this, change cleanup on the submit function
		height: 'auto',
		width: '100%',
		// autocomplete_url: URL.getTags,
		// onAddTag: function(tag){
		// 	var _this = $(this);
		// 	tagExists(tag, function(tagExists){
		// 		if(!tagExists){
		// 			// Tag does not exist. Update style
		// 			var container = _this.closest('.tagsinput');
		// 			var tagElement = _this.siblings('.tagsinput').children('.tag').last();
		// 			tagElement.addClass('new');
		// 		}
		// 	});
		// }
	};
	ENV.tagsDelimiter = ',, ,;';
	// $('#addIdea input[name=suggestTags]').tagsInput(ENV.tagConfig);
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
	// startOrganizationRatioScale();

	// Start autosuggest tags behavior
	// startTagsSuggestion(
	// 	'#addIdea textarea', 
	// 	'#addIdea .suggestedTags > div', 
	// 	'#addIdea input[name=tags]');

	setupTagPicker('#addIdea');

	/* Toolbar button handlers */
	TOOLBAR = {
		ideaViewer: {
			reload: ()=>{
				VIEWS.ideasView.load();
			},
			loadUserIdeas:()=>{
				VIEWS.ideasView.load();
			},
			loadFavoriteIdeas:()=>{
				VIEWS.ideasView.loadFavoriteIdeas();
			},
			loadAllIdeas:()=>{
				VIEWS.ideasView.loadIdeasAddedBy();
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

	// If this is a new user, start the process
	if(ENV.newUser){
		// Maximize first view
		setPhase(1);
		LAYOUT.root.getItemsById('ideaViewer')[0].toggleMaximise();
		// Start first tutorial
		startTutorial(ENV.firstTutorial);
	} else {
		setPhase(2);
	}

	// FInished loading page
	$('#loadingOverlay').fadeOut(1000, function(){
		$('body').removeClass('loading');
	});

	// Start periodically checking for updates
	var lastCheck = new Date().getTime();
	window.setInterval(function(){
		$.ajax({
			method: 'GET',
			url: URL.checkUpdates,
			data: {timestamp: lastCheck},
			success: function(needsUpdate){
				if (needsUpdate.toLowerCase() === 'true') {
					VIEWS.versioningView.setNeedsUpdate(true);
					VIEWS.solutionSpaceView.setNeedsUpdate(true);
				}
				lastCheck = new Date().getTime();
			}
		})
	}, 10000);
});

var startViewSequencing = function(){
	// Maximize idea workspace and hide step2 objects
	UTIL.setTimer($('#sessionTimer'), function(){
		$('#sessionTimer').fadeOut(500, function(){
			$('#openViews').fadeIn(500);
		});
	}, ENV.aloneIdeationTime * 60, false);
};

var openAllViews = function(){
	// Show other views
	var maximizedPanel = $('.lm_maximised .lm_content');
	maximizedPanel.animate({
		// These values come from the golden-layout.config.js
		height: maximizedPanel.height() * 0.5,
		width: maximizedPanel.width() * 0.69
	}, 200, function(){
		// Maximize other views
		LAYOUT.root.getItemsById('ideaViewer')[0].toggleMaximise();
		// Start tutorial for those views
		startTutorial(ENV.secondTutorial);
		// Set new phase
		incrementPhase();
	});
};

var setPhase = function(phase){
	// Increment phase
	var previousPhase = ENV.currentPhase;
	ENV.currentPhase = phase;
	// Show blacklisted elements from previous phase
	$('.phase' + previousPhase + '_bl').show();
	// hide blacklisted elements from current phase
	$('.phase' + ENV.currentPhase + '_bl').hide();
};

var incrementPhase = function(){
	setPhase(ENV.currentPhase + 1);
};

var setupTagPicker = function(selector){
	var tagPicker = $(selector);
	var tags = $('.tags', tagPicker);
	// Setup switcher
	$('.alternative', tagPicker).click(function(){
		switchPanel(tagPicker);
	});

	// Setup filter
	$('.search', tagPicker).on('keyup paste', function(e){
		var text = $(this).val().toLowerCase();
		console.dir(text);
		var show = $('li[class*="t_' + text + '"]', tags);
		var hide = $('li:not([class*="' + text + '"])', tags);
		hide.hide();
		show.show();
	});

	// Setup remove tag
	$('.tagPlaceholder .close').click(function(e){
		var pressedButton = $(this);
		var placeholder = pressedButton.closest('.tagPlaceholder');
		// Check if this is placeholder1
		var isPlaceholder1 = placeholder.is('.tagPlaceholder:first');
		if(isPlaceholder1){
			// Check if placeholder 2 is used
			var placeholder2 = $('.tagPlaceholder:eq(1)', tagPicker);
			var isPlaceholder2Empty = placeholder2.hasClass('empty');
			if (isPlaceholder2Empty) {
				// Ph2 is not being used. It's ok to empty Ph1
				removeTag(placeholder);
			} else {
				// Placeholder 1 is being deleted and 2 is used. Move ph2 to ph1 and delete ph2
				var text = $('.text', placeholder2).text();
				removeTag(placeholder2);
				removeTag(placeholder);
				setTag(placeholder, text);
			}
		} else {
			// Ph2 being deleted needs no checks
			removeTag(placeholder);
		}
	});
};

/*
	If toTagPicker == true, this will switch to (or remain on) the tagPicker.
	If undefined, it will just flip
*/
var switchPanel = function(tagPicker, toTagPicker){
	var customTagInput = $('#addIdea input[name=customTag]');
	var isAtCustomTag = customTagInput.val() === 'true';
	var changeNeeded = true;
	if(toTagPicker !== undefined){
		changeNeeded = toTagPicker && isAtCustomTag;
	}
	if(changeNeeded){
		$('#addIdea .panel').toggle('slow');
		customTagInput.val(!isAtCustomTag);
	}
};

var teardownTagPicker = function(tagPicker, reloadList){
	var tagsContainer = $('.tags', tagPicker);
	// Refresh tagPicker
	if(reloadList){
		$('.search', tagPicker).prop('disabled', true);
		tagsContainer.empty()
		tagsContainer.html('<li><div class="loadingBadge"></div></li>');
		tagsContainer.addClass('loading');
	}
	// Empty tag placeholders
	var placeholders = $('.tagPlaceholder', tagPicker);
	placeholders.each(function(i,d){
		removeTag($(d));
	});
	// Empty suggest tags
	$('.suggestTags [name=suggestTags]').val('');
	// Revert back to tagPicker
	switchPanel(tagPicker, true);
};

var setTag = function(placeholder, tag){
	$('.text', placeholder).text(tag);
	placeholder.removeClass('empty');
	// Add tag to hidden input
	var input = $('input[name=pickTags]');
	var current = input.val();
	var tags = current.split(ENV.tagsDelimiter);
	if(tags.indexOf(tag) < 0){ // Tag may already be in there
		if(tags.length===1 && tags[0]===''){
			// input is empty
			input.val(tag);
		} else {
			input.val(current + ENV.tagsDelimiter + tag);
		}
	}
};

var removeTag = function(placeholder){
	var text = $('.text', placeholder);
	var currentTag = text.text();
	text.text('');
	placeholder.addClass('empty');
	// Remove tag from hidden input
	var input = $('input[name=pickTags]');
	var current = input.val();
	var tags = current.split(ENV.tagsDelimiter);
	var newVal = '';
	if(tags.length > 1){
		var removeIndex = tags.indexOf(currentTag);
		tags.splice(removeIndex, 1);
		newVal = tags[0];
	}
	input.val(newVal);
}

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
	if($('#addIdea').hasClass('loading')){
		// It's in submission state, so don't submit again
		return false;
	}
	console.dir('Submitting');
	// Serialize form data
	var formElement = $(event.target).closest('form');
	var form = UTIL.objectifyForm(formElement.serializeArray(), {
		pickTags: function(value){
			if (value === ''){
				return [];
			} else {
				return value.split(ENV.tagsDelimiter);
			}
		},
		suggestTags: function(value){
			if(value.trim() === ''){ return undefined;}
			return value;
		}
	});
	var tags = form.customTag == 'true' ? form.suggestTags : form.pickTags;
	if (tags === undefined){
		tags = [];
	} else if (!(tags.constructor === Array)){
		tags = [tags];
	}
	// Validate tags. For some reason, the jQuery validator does not pick it up.
	if (tags.length < ENV.minNumberTags | tags.length > ENV.maxNumberTags  | !formElement.valid()){ 
		if (tags.length < ENV.minNumberTags){
			// Not enough tags. Throw a tantrum. 
			UTIL.insertErrorMessage('#addIdea form', 'Insert at least ' + ENV.minNumberTags + ' tag', 'errorTags');
		} else if(tags.length > ENV.maxNumberTags) {
			UTIL.insertErrorMessage('#addIdea form', 'Insert at most ' + ENV.maxNumberTags + ' tags', 'errorTags');
		} else {
			// Clean any tags errors
			$('#errorTags').remove();
		}
	} else {
		// Submit
		$('#addIdea').addClass('loading');
		submitIdea(form.idea, tags, 'original', [], function(data){
			var _id = JSON.parse(data).id;
			var _idea = form.idea;
			var _tags = tags;
			// Add to UI
			VIEWS.ideasView.addIdeaToDisplay({idea:_idea, id:_id, tags:_tags}, true);
			// Clearing up inputs and giving feedback to the user
			$('#addIdea textarea').val('');
			$('#addIdea textarea').focus();
			$('#addIdea .suggestedTags > div').html('');
			$.web2py.flash('Your idea has been added!', 'ok');
			// Remove loading
			$('#addIdea').removeClass('loading');
			// Reset tag picker
			teardownTagPicker($('#addIdea'), false);
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

var openInspirationPopup = function(event){
	openOverlay('inspiration');
};

// Opens up the popup overlay and sets up the popup using the function [popupId]Setup.
var openOverlay = function(popUpId, params){
	$('#overlay > div').hide();
	$('#overlay').fadeIn('fast');
	$('#' + popUpId).fadeIn('fast');
	// Set click on close button
	$('#' + popUpId + ' > .close').click(closeOverlay);
	// Call setup function for the ID
	window[popUpId + 'Setup'](params);
};

var closeOverlay = function(event){
	if(!event || $(event.target).is('#overlay, .popupDialog > .close')){
		$('#overlay').fadeOut('fast');

		// Call event handlers
		for(var i = 0; i < EVENTS.popOverClose.length; i++){
			var handler = EVENTS.popOverClose.pop();
			handler();
		}
	}
	
};

var editIdeaSetup = function(params){
	$.ajax({
		method: 'GET',
		url: URL.getIdeaById,
		data: {id: params.id},
		success: function(data){
			$('#editIdea').removeClass('loading');
			// Update view
			var data = JSON.parse(data);
			var ideaText = $('#editIdea .ideaText');
			var tags = $('#editIdea .tags');
			tags.empty();
			// Add idea text
			ideaText.text(data.idea);
			// Add tags
			data.tags.forEach(function(d,i){
				let tag = $('<li></li>').text(d);
				tags.append(tag);
			});
			// Setup teardown
			EVENTS.popOverClose.push(function(){
				$('#editIdea').addClass('loading');
			});
		}
	});
}

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
		// Remove loading badge
		container.empty();
		// Add ideas
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
				// Add ideas
				addIdeasToContainer($('#tagsView .' + ENV.classPrefix + d + ' ul'), ideas);
			}
		});
	});
}

var addIdeaSetup = function(){
	// Set focus for immediate typing
	$('#addIdea textarea').focus();
	var tagPicker = $('#addIdea .tagPicker');
	var tagsContainer = $('.tags', tagPicker);
	// Load available tags
	$.ajax({
		type: 'GET',
		url: URL.getAllTags,
		success: function(data){
			// Load tags
			tagsContainer.removeClass('loading');
			tagsContainer.empty();
			data.forEach(function(d,i){
				let li = $('<li></li>').addClass('t_' + d).text(d);
				tagsContainer.append(li);
			});
			// Setup click on tag
			$('li',tagPicker).click(function(){
				var tag = $(this).text();
				var placeholder = $('.tagPlaceholder.empty:first', tagPicker);
				if(placeholder.length > 0){
					// Check if a placeholder already holds this tag
					var placeholders = $('.tagPlaceholder', tagPicker);
					for (let i = 0; i < placeholders.length; i++) {
						const ph = placeholders[i];
						if($('.text', ph).text() === tag){
							return false;
						}
					}
					setTag(placeholder, tag);
				}
			});
			// Enable filter
			$('.search', tagPicker).prop('disabled', false);
		}
	});
	// Revert tagPicker panel
	EVENTS.popOverClose.push(function(){
		teardownTagPicker(tagPicker, true);
	});
}

var inspirationSetup = function(){
	var template = $(Mustache.render(TEMPLATES['inspirationPopupTemplate']));
	$('#inspiration').html(template);
	$.ajax({
		type: "GET",
		url: URL.getAvailableTasks,
		success: (data)=>{
			buildInspirationPanel(data);
		}
	});
};

var buildInspirationPanel = function(structure){
	var tasksList = $('#inspirationPanel');
	tasksList.empty();
	tasksList.removeClass('loading');
	var maxHeight = -1;
	for(var i = 0; i < structure.length; i++){
		// Preparing data
		var taskId = structure[i].task.id;
		var taskType = structure[i].task.task_type;
		var idea = {
			idea: structure[i].idea.idea, 
			id: structure[i].idea.id, 
			tags: [],
			favorite: structure[i].idea.favorite
		};
		// Setting up HTML
		var params = {closeable: false, focuseable: true, source: this.constructor}
		var ideaElement = new Idea(idea, params);
		var templateParams = {id: taskId, type: taskType}
		var template = $(Mustache.render(TEMPLATES[taskType + 'Template'], templateParams));
		var innerForm = $('<form></form>').html(template)
		var taskItem = $("<li></li>").append(innerForm);
		// Custom processing for each task type
		taskTypeProcessor(taskType, innerForm, structure[i].task).pre();
		// Finish setting up idea in the template
		$('#ideaPlaceholder', taskItem).replaceWith(ideaElement.html());
		$('.ideaBlock', taskItem).css('display', 'block');
		taskItem.attr('id', 'task-' + structure[i].id);
		// TODO handle submission
		// $('.btn', taskItem).click((e)=>{this.submitTask(e)});
		// Dramatic entrance
		tasksList.append(taskItem);
		maxHeight = taskItem.height() > maxHeight ? taskItem.height() : maxHeight;
		if (i===0){
			taskItem.hide();
			taskItem.addClass('selected');
			taskItem.show(500, function(){
				tasksList.css('height', maxHeight);
			});
		}
		// Setup input tag. For some reason, it doesn't work before element is visible. TODO figure better workaround
		$('.tagInput', tasksList).tagsInput(ENV.tagConfig);
		// Configure max height for tasks
		
	}
	// Show tasks
	tasksList.show('fast');
	prepareButtons($('#inspirationControls'), tasksList, structure.length);
};

var prepareButtons = function(container, tasksContainer, n){
	// Set stages
	var stages = $('span.stages', container);
	stages.text('1/' + n);
	// Create move function
	var move = function(fn){
		var current = $('li.selected', tasksContainer);
		var moveTo = current[fn]();
		var nextCount = current[fn + 'All']().length;
		// Setup animation
		var moveWidth = 550; // TODO calculate dynamically
		var negativeMargin = '-' + moveWidth + 'px';
		var neutralMargin = '0px';
		var animateObject = fn == 'next' ? current : moveTo;
		// Execute
		if(moveTo.length !== 0){
			var counter = 1;
			// Setup first frame
			if(fn == 'next'){
				counter = (n - nextCount + 1);
				moveTo.show();
			} else {
				counter = nextCount;
				moveTo.css('margin-left', negativeMargin);
				moveTo.show();
			}
			// Update countner
			stages.text(counter + '/' + n);
			// Animate
			animateObject.animate({
				marginLeft: fn == 'next' ? negativeMargin : neutralMargin
			}, 
			500, 
			function(){
				current.hide();
				current.removeClass('selected');
				moveTo.addClass('selected');
				// Reset margin
				current.css('margin-left', '0');
			});	
		}
		// Update first or last classes
		if(moveTo.next().length === 0){
			// This is the last item
			container.addClass('last');
		} else if (moveTo.prev().length === 0) {
			container.addClass('first');
		} else {
			container.removeClass('first').removeClass('last');
		}
	};
	// Setup buttons
	var previous = $('.previous', container);
	var next = $('.next', container);
	next.click(function(){ move('next') });
	previous.click(function(){ move('prev') });
	// Display
	container.fadeIn('slow');
};

/*
This function receives a type of task as parameter, and outputs a function for processing
either the view compilation (pre) or answer processing (post) of specific task types. 
pre does not return anything, but can alter the task form as required.
post must return the final answer in JSON.
*/
var taskTypeProcessor = function(type, form, task){
	return {
		'TagSuggestionTask': {
			'pre': function(){},
			'post': function(){
				var rawAnswer = $('[name=answer]', form).val()
				var answer = rawAnswer.split(ENV.tagsDelimiter);
				return JSON.stringify(answer);
			}
		},
		'TagValidationTask': {
			'pre': function(){
				// select best or categorize tasks
				var tags = JSON.parse(task.options);
				var tagsList = $('.tagsList', form);
				// Add labels
				for(var i = 0; i < tags.length; i++){
					var tag = $(Mustache.render(TEMPLATES.tagTemplate, {tag:tags[i]}));
					tagsList.append($("<li></li>").html(tag));
					tag.click(function(event){
						var parent = $(this).closest('.tagsList');
						if (parent.hasClass('single')){
							// This list supports only one selected tag. Unselect currently selected tags.
							$('.selected', parent).removeClass('selected');
						}
						$(this).toggleClass('selected');
					});
				};
			},
			'post': function(){
				var selectedTag = $('.tagsList .selected', form).text();
				return selectedTag;
			}
		}
	}[type];
}

var submitInspirationTask = function(event){
	var forms = $('#inspirationPanel form');
	$.each(forms, function(i, form){
		// Get data
		var id = $('[name=taskId]', form).val();
		var type = $('[name=taskType]', form).val();
		var answer = taskTypeProcessor(type, form).post();
		var data = {
			id:id,
			type:type,
			answer:answer
		};
		// Submit
		var _this = this;
		$.ajax({
			type: "POST",
			url: URL.submitTask,
			data: data,
			success: function(data){
				$.web2py.flash('Your tasks have been submitted!', 'ok');
				// Close overlay
				closeOverlay();
			},
			error: function(){
				$.web2py.flash('Something went wrong!', 'error');
			}
		});
	});
	
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
		$.each(data, function(i,d){
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

var startTutorial = function(tutorial){
	// Start tutorial
	tutorial.start();
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