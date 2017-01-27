$(function(){

	$(document).click(function(event) { 
	    if(!$(event.target).closest('.popupDialog').length) {
	        if($('.popupDialog').is(":visible")) {
	            $('.popupDialog').fadeOut('fast');
	        }
	    }        
	});

	// Load user ideas to the viewer
	loadIdeas();

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

var loadIdeas = function(){
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

var addIdeaToDisplay = function(idea){
	$("#ideasContainer").append($("<p></p>").text(idea).append('<span class="overlay"></span>'));

};

var submitIdeaSuccess = function(idea){
	// Add to UI
	addIdeaToDisplay(idea);
	// Clearing up inputs and giving feedback to the user
	$("#addIdeaPopup input, #addIdeaPopup textarea").val("");
	$("#addIdeaPopup textarea").focus();
	$.web2py.flash("Your idea has been added!", "");
};