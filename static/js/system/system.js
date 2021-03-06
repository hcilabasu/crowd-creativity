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

	/* 
		CREATE TUTORIAL STEPS
	*/
	var ideaWorkspaceTutorialSteps = [
		{
			title: 'Idea Workspace',
			highlight: '.stack_IdeaViewerView',
			html: Mustache.render(TEMPLATES.tutorialExpandedIdeaViewer1Template),
			location: {right: 20, top: 0},
		},
		{
			title: 'Refining ideas',
			highlight: '.stack_IdeaViewerView',
			html: Mustache.render(TEMPLATES.tutorialExpandedIdeaViewer2Template),
			location: {right: 20, top: 0},
		},
		{
			title: 'Combining ideas',
			highlight: '.stack_IdeaViewerView',
			html: Mustache.render(TEMPLATES.tutorialExpandedIdeaViewer3Template),
			location: {right: 20, top: 0},
		}
	];

	var solutionSpaceTutorialSteps = [
		{
			title: 'Solution space view',
			highlight: '.stack_SolutionSpaceView',
			html: Mustache.render(TEMPLATES.tutorialExpandedSolutionSpace1Template),
			location: {left: 20, top: 0}
		},
		{
			title: 'Solution space view',
			highlight: '.stack_SolutionSpaceView',
			html: Mustache.render(TEMPLATES.tutorialExpandedSolutionSpace2Template),
			location: {left: 20, top: 0}, // TODO the tutorial.js positioning system needs to be improved
		}
	];

	var firstTutorialSteps = [ // Steps
		{
			title: 'Welcome',
			html: Mustache.render(TEMPLATES.tutorialWelcomeTemplate)
		},	
		{
			title: 'Brainstorming topic',
			highlight: '#problem > span',
			html: Mustache.render(TEMPLATES.tutorialTopicTemplate),
			location: {left: 'center', bottom: 20}

		},
		{
			title: 'The 3 ways of adding ideas',
			html: Mustache.render(TEMPLATES.tutorialMainActionsTemplate)
		},
		{
			title: 'Add a new Idea',
			highlight: '#newIdeaButton',
			html: Mustache.render(TEMPLATES.tutorialAddIdeaTemplate),
			location: {left: 'center', bottom: 20}
		},
	].concat(ideaWorkspaceTutorialSteps);

	var secondTutorialSteps = solutionSpaceTutorialSteps;
	secondTutorialSteps.push({
		title: 'Inspiration button',
		highlight: '#helpButton',
		html: Mustache.render(TEMPLATES.tutorialInspirationTemplate),
		location: {left: 'center', bottom: 20}
	});

	/*
		Create tutorial objects
	*/
	ENV.firstTutorial = new Tutorial(
		{ // Settings
			onclose: function(){
				// When the first tutorial is closed, start the timer
				startViewSequencing();
			}
		},
		firstTutorialSteps
	);
	ENV.secondTutorial = new Tutorial(
		{ // Settings
			onclose: function(){
				// Reload other views
				VIEWS.solutionSpaceView.load();
				// VIEWS.versioningView.load();
			}
		},
		secondTutorialSteps
	);
	ENV.fullTutorial = new Tutorial(
		{},
		firstTutorialSteps.concat(secondTutorialSteps)
	);
	ENV.studyTutorial = new Tutorial(
		{
			onclose: function(){
				setupStudySession();
				log('end_tutorial');
			},
			forceCompletion: true
		},
		firstTutorialSteps.concat(secondTutorialSteps)
	);

	// Enable tooltips
	$( document ).tooltip({
		position: {
			my: 'center top+15',
			at: "center bottom",
			collision: 'flipfit'
		},
		show: false,
		hide: false
	});

	// Close overlay on click
	$('#overlay').click(closeOverlay);

	// Start tag input
	ENV.tagConfig = {
		delimiter: [',', ' ', ';'], // Doesn't seem like I can set the UI delimiters separate from the backend. If you change this, change cleanup on the submit function
		height: 'auto',
		width: '100%',
	};
	ENV.tagsDelimiter = ',, ,;';
	$('#combineIdeas input[name=combinedTagInput]').tagsInput(ENV.tagConfig);

	// Load windowed layout
	LAYOUT.init();

	// Load panels on page load
	VIEWS['ideasView'] = new IdeaViewerView('#ideasContainer').load();
	// VIEWS['versioningView'] = new VersioningView('#versioningContainer').load();
	VIEWS['solutionSpaceView'] = new SolutionSpaceView('#solutionSpaceContainer').load();
	
	/* Toolbar button handlers */
	TOOLBAR = {
		ideaViewer: {
			reload: ()=>{
				VIEWS.ideasView.load();
			},
			loadUserIdeas:()=>{
				VIEWS.ideasView.loadIdeasAddedBy(ENV.userId);
			},
			loadFavoriteIdeas:()=>{
				VIEWS.ideasView.loadFavoriteIdeas();
			},
			loadAllIdeas:()=>{
				VIEWS.ideasView.loadIdeasAddedBy();
			},
			help:()=>{
				startTutorial(new Tutorial(
					{},
					ideaWorkspaceTutorialSteps
				));
			}
		},
		/*versioningView: {
			reload: ()=>{
				VIEWS.versioningView.load();
			},
			toggleAutoReload: ()=>{
				UTIL.toggleTimer($('#versioningTimerDisplay'), ()=>VIEWS.versioningView.load());
			},
			help: () =>{
				startTutorial(new Tutorial(
					{},
					versioningViewTutorialSteps
				));
			}
		},*/
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
			},
			toggleMinimap: function(){
				var button = $('#toggleMinimap');
				VIEWS.solutionSpaceView.toggleMinimap(button);
			},
			help: () =>{
				startTutorial(new Tutorial(
					{},
					solutionSpaceTutorialSteps
				));
			}
		},
		general: {
			toggleMaximise: (viewId)=>{
				toggleMaximise(viewId);
			}
		}
	};

	// Set phase and tutorials
	setPhase(2);
	var tutorial = ENV.fullTutorial;
	// Do study session tutorial and setup
	if(ENV.isStudySession){		
		tutorial = ENV.studyTutorial;
		if (!ENV.newUser){ // Only run this if it's not a new user
			setupStudySession();
		}
	}
	// If this is a new user, run tutorial
	if (ENV.newUser){
		startTutorial(tutorial);
	}

	// Finished loading page
	$('#loadingOverlay').fadeOut(1000, function(){
		$('body').removeClass('loading');
	});

	// Start periodically checking for updates
	ENV.lastCheck = new Date().getTime();
	window.setInterval(function(){
		$.ajax({
			method: 'GET',
			url: URL.checkUpdates,
			data: {timestamp: ENV.lastCheck},
			success: function(needsUpdate){
				if (needsUpdate.toLowerCase() === 'true') {
					// VIEWS.versioningView.setNeedsUpdate(true);
					VIEWS.solutionSpaceView.setNeedsUpdate(true);
				}
				ENV.lastCheck = new Date().getTime();
			}
		})
	}, 10000);

	// Setup expanded problem description button 
	var problemContainer = $('#problem');
	$('a', problemContainer).click(function(){
		$('.expanded-description').slideToggle('fast');
		$('.vertical', problemContainer).fadeToggle('fast');
	})
});

var startViewSequencing = function(){
	// Maximize idea workspace and hide step2 objects
	UTIL.setTimer($('#sessionTimer'), function(){
		$('#sessionTimer').fadeOut(500, function(){
			$('#openViews').fadeIn(500);
		});
	}, ENV.aloneIdeationTime * 60, false);
};

var setupStudySession = function(){
	// Setup timer
	var sessionConcludedStorage = 'sessionConcluded' + ENV.problemId + ENV.userId;
	var conclude = function(){
		$('#studyTimer').fadeOut(500, function(){
			$('#concludeSession').fadeIn(500);
			localStorage[sessionConcludedStorage] = true;
			concludeSession();
			// Send ajax request to log on server
			log('end_study');
		});
	};
	if(localStorage[sessionConcludedStorage] === 'true'){
		conclude();
	} else {
		UTIL.setTimer($('#studyTimer'), conclude, ENV.studyIdeationTime * 60, false);
	}
}

var log = function(action, data){
	$.ajax({
		method: 'GET',
		url: URL.log,
		data: {action:action, data:data}
	});
}

var concludeSession = function(){
	openOverlay('sessionConclusion');
}

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

var toggleMaximise = function(viewId){
	LAYOUT.root.getItemsById(viewId)[0].toggleMaximise();
};

var setPhase = function(phase){
	// Increment phase
	var previousPhase = ENV.currentPhase;
	ENV.currentPhase = phase;
	// Show blacklisted elements from previous phase
	$('.phase' + previousPhase + '_bl').show();
	// Remove previous phase classes
	$('.phase' + previousPhase + '_cl').each(function(i,d){
		var classes = $(d).data('phase' + previousPhase + 'cl');
		$(d).removeClass(classes);
	});
	// hide blacklisted elements from current phase
	$('.phase' + ENV.currentPhase + '_bl').hide();
	// Add current phase classes
	$('.phase' + ENV.currentPhase + '_cl').each(function(i,d){
		var classes = $(d).data('phase' + previousPhase + 'cl');
		$(d).addClass(classes);
	});
};

var incrementPhase = function(){
	setPhase(ENV.currentPhase + 1);
};

var submitNewIdea = function(event){
	if($('#addIdea').hasClass('loading')){
		// It's in submission state, so don't submit again
		return false;
	}
	// Serialize form data
	var formElement = $(event.target).closest('form');
	var form = UTIL.objectifyForm(formElement.serializeArray());
	// Validate tag picker
	var tagsValidation = $('#newIdeaTagPicker').tagPicker('validate', {
		displayErrorMessage: function(tagPicker){
			UTIL.insertErrorMessage('#newIdeaTagPicker .alternative', 'Insert at least ' + ENV.minNumberTags + ' tag', 'errorTags');
		},
		hideErrorMessage: function(tagPicker){
			$('.utilError', tagPicker).remove();
		}
	});
	// Validate tags. For some reason, the jQuery validator does not pick it up.
	if (formElement.valid() & tagsValidation.valid){ 
		var tags = tagsValidation.tags;
		// Submit
		$('#addIdea').addClass('loading');
		submitIdea(form.idea, tags, 'original', [], function(data){
			var _id = JSON.parse(data).id;
			var _idea = form.idea;
			var _tags = tags;
			// Close popup
			closeOverlay();
			// Add to UI
			VIEWS.ideasView.load();
			// VIEWS.ideasView.addIdeaToDisplay({idea:_idea, id:_id, tags:_tags}, true);
			// Clearing up inputs and giving feedback to the user
			$('#addIdea textarea').val('');
			$('#addIdea textarea').focus();
			$('#addIdea .suggestedTags > div').html('');
			// Remove loading
			$('#addIdea').removeClass('loading');
			// Reset tag picker
			$('#newIdeaTagPicker').tagPicker('teardown');
			// Reset other views and reset check timer
			VIEWS.solutionSpaceView.load();
			// VIEWS.versioningView.load();
			ENV.lastCheck = new Date().getTime();
		}, function(data){
			// Remove loading
			$('#addIdea').removeClass('loading');
		});
	}
};

var submitRefinedIdea = function(event){
	// Validate
	var idea = $('#editIdea [name=refinedIdea]').val();
	var originalText = $('#editIdea [name=originalText]').val();
	if(idea.trim() === originalText.trim()){
		$('#repeatedRefinedIdea').show('fast');
	} else {
		if($('form.editElement').valid()){
			// Hide button
			$('#editIdea a.submit').hide();
			$('#editIdea .loadingBadge').show();
			var tags = $('#editIdea [name=tags]').val().split(ENV.tagsDelimiter);
			var originalId = $('#editIdea [name=originalId]').val();
			submitIdea(idea, tags, type='refinement', [originalId], function(data){
				var _id = JSON.parse(data).id;
				var _idea = idea;
				var _tags = tags;
				$('#editIdea a.submit').show();
				$('#editIdea .loadingBadge').hide();
				// Add new idea to UI
				VIEWS.ideasView.load();
				// VIEWS.ideasView.addIdeaToDisplay({idea:_idea, id:_id, tags:_tags}, true);
				// Reset other views and reset check timer
				VIEWS.solutionSpaceView.load();
				// VIEWS.versioningView.load();
				ENV.lastCheck = new Date().getTime();
				// Close overlay
				closeOverlay();
			});
		}
	}
};

var submitCombinedIdea = function(event){
	var tagsValidation = $('#combinedTagInput').tagPicker('validate', {
		displayErrorMessage: function(tagPicker){
			UTIL.insertErrorMessage('#combineIdeas .alternative', 'Insert at least ' + ENV.minNumberTags + ' tag', 'errorTags');
		},
		hideErrorMessage: function(tagPicker){
			$('.utilError', tagPicker).remove();
		}
	});
	if($('#combineIdeas .ideaInput').valid() & tagsValidation.valid){
		// Hide button
		$('#combineIdeas a.btn').hide();
		$('#combineIdeas .loadingBadge').show();

		var idea = $('#combineIdeas textarea').val();
		var type = $('#combineIdeas input[name=combineTypeInput]').val();
		var tags = tagsValidation.tags;
		var sources = JSON.parse($('#combineIdeas input[name=combinedIdeaIds]').val());
		submitIdea(idea, tags, type, sources, function(data){
			$('#combineIdeas a.btn').show();
			$('#combineIdeas .loadingBadge').hide();
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
			VIEWS.ideasView.load();
			// VIEWS.ideasView.addIdeaToDisplay({idea:_idea, id:_id, tags:_tags});

			// Reset other views and reset check timer
			VIEWS.solutionSpaceView.load();
			// VIEWS.versioningView.load();
			ENV.lastCheck = new Date().getTime();
			// Close overlay
			closeOverlay();
		});
	}
};

var submitIdea = function(idea, tags, origin, sources, successCallback, errorCallBack){
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
			// Popup alert
			$.web2py.flash('Your idea has been added!', 'ok');
			// Trigger event
			$.event.trigger({type:EVENTS.ideaSubmitted, params:{idea:idea}});
		},
		error: function(data){
			if(errorCallBack){
				errorCallBack(data);
			}
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
	var popup = $('#editIdea');
	var template = $(Mustache.render(TEMPLATES['editIdeaPopupTemplate']));
	if (popup.is(':empty')){ // Only load the html the first time
		popup.html(template);
	} else {
		// Hide error message
		$('#repeatedRefinedIdea').hide();
	}
	var type = 'view';
	if(params.edit){
		type = 'edit';
	}
	$('#editIdea').addClass(type);

	$.ajax({
		method: 'GET',
		url: URL.getIdeaById,
		data: {id: params.id},
		success: function(data){
			$('#editIdea').removeClass('loading');
			// Update view
			var data = JSON.parse(data);
			var ideaText = $('#editIdea .ideaText');
			var ideaTextarea = $('#editIdea textarea');
			var tags = $('#editIdea .tags');
			var tagsHidden = $('#editIdea [name=tags]');
			var originalId = $('#editIdea [name=originalId]');
			var originalHidden = $('#editIdea [name=originalText]');
			tags.empty();
			// Add idea text
			ideaText.text(data.idea);
			ideaTextarea.val(data.idea);
			originalHidden.val(data.idea);
			// Add tags
			var tagsString = data.tags.join(ENV.tagsDelimiter);
			tagsHidden.val(tagsString);
			data.tags.forEach(function(d,i){
				let tag = $('<li></li>').text(d);
				tags.append(tag);
			});
			// Setup other hidden fields
			originalId.val(params.id);
			// Setup teardown
			EVENTS.popOverClose.push(function(){
				$('#editIdea').addClass('loading');
				$('#editIdea').removeClass(type);
			});
		}
	});
}

var combineIdeasSetup = function(params){
	var popup = $('#combineIdeas');
	// popup.removeClass('chosen');
	var template = $(Mustache.render(TEMPLATES['combineIdeaPopupTemplate']));
	if (popup.is(':empty')){ // Only load the html the first time
		popup.html(template);
	}
	// Hide and show elements
	// $('.merge,.combine', popup).hide();
	// $('.choose', popup).show();
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
	$('#combinedTagInput').tagPicker('setup');

	// Set up tear down function
	EVENTS.popOverClose.push(function(){
		// Empty fields
		$('#combineIdeas textarea').val('');
		// $('#combineIdeas input[name=combineTypeInput]').val('');
		$('#combineIdeas input[name=ideaIds]').val('');
		// Switch back options panel
		// replaceCombineIdeasOptions(undefined, 'back');
		closeOverlay();
	});
}

// var replaceCombineIdeasOptions = function(event, type){
// 	var popup = $('#combineIdeas');
// 	if(type == 'back'){
// 		popup.removeClass('chosen');
// 		$('.merge,.combine', popup).filter(':not(.choose)').hide('fast');
// 		$('.choose', popup).show('fast');
// 	} else {
// 		popup.addClass('chosen');
// 		$('.merge,.combine,.choose', popup).filter(':not(.'+type+')').hide('fast', function(){
// 			$('.' + type, popup).show('fast');
// 		});
// 		// Sets the text in the paragraph
// 		$('#combineIdeas textarea').attr('placeholder','Write your ' + type + 'd' + ' idea here');
// 		$('#combineIdeas input[name=combineTypeInput]').val(type);
// 	}
// };

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
			var ideaElement = new Idea(d, {closeable:false, draggable:true, resizable: false, focuseable: false, expandable: false});
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
	$('#tagsView .cl_').remove();
}

var addIdeaSetup = function(){
	var popup = $('#addIdea');
	var template = $(Mustache.render(TEMPLATES['addIdeaPopupTemplate']));
	if (popup.is(':empty')){ // Only load the html the first time
		popup.html(template);
	}
	// Set focus for immediate typing
	$('#addIdea textarea').focus();
	var tagPicker = $('#newIdeaTagPicker').tagPicker('setup');
	// Revert tagPicker panel
	EVENTS.popOverClose.push(function(){
		$('#newIdeaTagPicker').tagPicker('teardown');
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
	// Handle inspiration tutorial and buttons
	var closeHelp = function(){
		$('#inspiration .helpPanel').hide();
		$('#inspiration .tasksPanel').show();
		$('#inspiration .help').css('display','inline-block');
		ENV.doneInspirationTutorial = true;
	};
	var openHelp = function(){
		$('#inspiration .helpPanel').show();
		$('#inspiration .tasksPanel').hide();
		$('#inspiration .help').css('display','none');
	};
	// Set click handlers
	$('#finishInspirationTutorial').click(closeHelp);
	$('#inspiration .help').click(openHelp);
	// Set initial state
	if(ENV.doneInspirationTutorial){
		closeHelp();
	}
};

var buildInspirationPanel = function(structure){
	var tasksList = $('#inspirationPanel');
	tasksList.empty();
	tasksList.removeClass('loading');
	var maxHeight = -1;
	if(structure.length > 0){
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
			var params = {closeable: false, focuseable: false, source: this.constructor}
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
	} else {
		$('.tasksPanel').text('There are no inspiration tasks available for you. Check back later! :)');
	}
};

var prepareButtons = function(container, tasksContainer, n){
	// Set stages
	var stages = $('span.stages', container);
	stages.text('1/' + n);
	if(n == 1) {
		// There's only one inspiration
		container.addClass('last');
	}
	// Create move function
	var move = function(fn){
		var current = $('li.selected', tasksContainer);
		var currentForm = $('form', current);
		var taskType = $('[name=taskType]', currentForm).val();
		var moveTo = current[fn]();
		var nextCount = current[fn + 'All']().length;
		// Setup animation
		var moveWidth = 550; // TODO calculate dynamically
		var negativeMargin = '-' + moveWidth + 'px';
		var neutralMargin = '0px';
		var animateObject = fn == 'next' ? current : moveTo;
		// Execute
		if(taskTypeProcessor(taskType, currentForm).isValid()){ // Validate
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
post must return the final answer in JSON for storage in the DB.
*/
var taskTypeProcessor = function(type, form, task){
	return {
		TagSuggestionTask: {
			pre: function(){},
			post: function(){
				var rawAnswer = $('[name=answer]', form).val()
				var answer = rawAnswer.split(ENV.tagsDelimiter);
				return JSON.stringify(answer);
			},
			isValid: function() { return true; }
		},
		TagValidationTask: {
			pre: function(){
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
			post: function(){
				var selectedTag = $('.tagsList .selected', form).text();
				return selectedTag;
			},
			isValid: function() { return true; }
		},
		RatingTask: {
			pre: function(){},
			post: function(){
				// TODO validate
				var originality = $('[name=originality]:checked', form).val();
				var usefulness = $('[name=usefulness]:checked', form).val();
				return JSON.stringify({originality: originality, usefulness:usefulness});
			},
			isValid: function(){
				return form.valid();
			}
		}
	}[type];
}

var submitInspirationTask = function(event){
	var forms = $('#inspirationPanel form');
	var lastForm = forms.last();
	if(lastForm.valid()){
		var numForms = forms.length;
		$.each(forms, function(i, form){
			lastTask = (numForms == i+1) ? true : false;
			// Validate last form. All others have been validated on move
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
			var _lastTask = lastTask;
			$.ajax({
				type: "POST",
				url: URL.submitTask,
				data: data,
				success: function(data){
					if(_lastTask){
						var dataObj = JSON.parse(data);
						// Reload idea viewer
						VIEWS.ideasView.load();
						// Notify and close overlay
						$.web2py.flash('Your tasks have been submitted!', 'ok');
						// Close overlay
						closeOverlay();

					}
				},
				error: function(){
					$.web2py.flash('Something went wrong!', 'error');
				}
			});
		});
	}
	
}

var startTagsSuggestion = function(watchInput, suggestionContainer, tagsInput){

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

var openHelp = function(){
	startTutorial(ENV.fullTutorial);
}

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

// Right now this only works for the dropdown in the header
var copyToClipboard = function(clicked){
	$(clicked).closest('.dropDown').find('input').select();
	document.execCommand('copy');
}

var sessionConclusionSetup = function(){
	var popup = $('#sessionConclusion');
	var template = $(Mustache.render(TEMPLATES['sessionConclusionTemplate']));
	if (popup.is(':empty')){ // Only load the html the first time
		popup.html(template);
	}
}