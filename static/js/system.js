$(function(){

	$(document).click(function(event) { 
	    if(!$(event.target).closest('.popupDialog').length) {
	        if($('.popupDialog').is(':visible')) {
	            $('.popupDialog').fadeOut('fast');
	        }
	        if($('#overlay').is(':visible')) {
	        	$('#overlay').fadeOut('fast');
	        }
	    }        
	});

	// Load panels on page load
	loadUserIdeas();
	loadVersioningPanel();


});

var openIdeaPopup = function(event){
	$("#addIdeaPopup").fadeToggle('fast');
	$("#addIdeaPopup textarea").focus();
	event.stopPropagation();
};

var submitIdea = function(event){
	// Get values
	var idea = $("#addIdeaPopup textarea").val();
	var category = $("#addIdeaPopup input").val();

	// Send to server
    $.ajax({
        type: "POST",
        url: URL.addIdea,
        data: {
            "idea": idea,
            "concepts": [category]
        },
        success: function(){
        	var _idea = idea;
        	submitIdeaSuccess(_idea);
        }
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
        url: URL.getAllIdeas,
        success: function(data){
        	ideas = JSON.parse(data);
        	buildVersioningPanel(ideas);
        }
    });
};

var addIdeaToDisplay = function(idea){
	var ideaBlock = $('<p class="ideaBlock"></p>').text(idea).append('<span></span>');
	$("#ideasContainer").append(ideaBlock);
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
			var idea1 = ui.draggable.text();
			var idea2 = $(this).text();
			toggleOverlay('combineIdeas', {ideas: [idea1, idea2]});
		},
		classes: {
			'ui-droppable-hover': 'ideaHover'
		}
	});
};

var buildVersioningPanel = function(ideas){
	$("#versioningContainer").text('');
}

var submitIdeaSuccess = function(idea){
	// Add to UI
	addIdeaToDisplay(idea);
	// Clearing up inputs and giving feedback to the user
	$("#addIdeaPopup input, #addIdeaPopup textarea").val("");
	$("#addIdeaPopup textarea").focus();
	$.web2py.flash("Your idea has been added!", "");
};

var toggleOverlay = function(popUpId, params){
	$('#overlay').fadeToggle('fast');
	$('#' + popUpId).fadeToggle('fast');
	// Call setup function for the ID
	window[popUpId + 'Setup'](params);
};

var combineIdeasSetup = function(params){
	$('#combineIdeas .ideaBlock').each(function(index){
		$(this).text(params['ideas'][index]);
	});
}

var replaceCombineIdeasOptions = function(event, type){
	$('#combineIdeas .choices').fadeOut('fast');
	$('#combineIdeas .ideaInput').fadeIn('fast');

	$('.combinationType').text(type + 'd');
}