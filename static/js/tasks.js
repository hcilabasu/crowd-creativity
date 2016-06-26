/*
* Depends on:
* - URL.addIdea
* - URL.getNewIdeas
* - ENV.condition
*/

$(function(){

    var maxCatCharacters = 20;
    var maxIdeaCharacters = 20;
    var validationError = false;

    var userIdeaCounter = 0;
    var lastUpdateTime = null;
    var othersIndex = 0;

    var maxTime = 18;

    // Start timer
    var interval = window.setInterval(function(){
        var remaining = moment.duration(maxTime,'minutes').subtract(moment.utc(ENV.startTime).countdown(moment.utc()));
        var minutes = remaining.get('minutes');
        var seconds = remaining.get('seconds');

        // Dealing with formatting--quick and dirty
        var minutesPadding = minutes < 10 ? "0" : "";
        var secondsPadding = seconds < 10 ? "0" : "";
        $("#timer").text(minutesPadding + minutes + ":" + secondsPadding + seconds);

        if(minutes <= 0 && seconds <= 0){
            // Time's up
            clearInterval(interval);
            $("#timer").text("00:00");
            finishSession();
        }
    }, 1000);
    
    $("#idea-submit").click(function(e){
        // get inputs
        var ideaInput = $("#idea-input");
        // get their content
        var text = ideaInput.val();

        if(!text){
            alert("The idea text is mandatory!");
            validationError = true;
        } else if (text.length > 1000){
            alert("You can use at most " + maxIdeaCharacters + " characters in your idea");
        }
        
        if(!validationError){
            // clear inputs
            ideaInput.val("");

            // Increase idea counter
            userIdeaCounter++;
            
            // Send idea to server
            addIdea(text, function(){
                // Add idea to user's view
                $("#no-user-idea").remove();
                $("#user-ideas").prepend("<li class='list-group-item'><p>" + text + "</p></li>")    
            });
        }    
    });

    $("#inspiration-request").click(function(e){
        $.ajax({
            type: "GET",
            url: URL.getIdea,
            success: getIdeaForTask
        });
    });

    $("#task-submit").click(function(e){
        var originalityInput = $("input[name=originality]:checked");
        var usefulnessInput = $("input[name=usefulness]:checked");
        var similarityInput = $("input[name=similarity]:checked");

        var ideaIds = JSON.parse($("#idea-id").val());
        var originality = originalityInput.val();
        var usefulness = usefulnessInput.val();
        var similarity = similarityInput.val();

        if(ENV.condition === 3 && (!originality || !usefulness)){
            alert("Both ratings are mandatory!");
        } else if(ENV.condition === 4 && (!similarity)){
            alert("You must select a similarity rating!");
        } else {
            // Submit
            $.ajax({
                type: "POST",
                url: URL.rateIdea,
                data: {
                    ideaIds: ideaIds,
                    originality: originality,
                    usefulness: usefulness,
                    similarity: similarity
                },
                success: rateIdea
            })
        }
    });

    $("#close-idea").click(function(e){
        $(".toggle").toggleClass("hidden");
    });
    
    $("#get-code").click(function(){
        getCodeClick();
    });

    var addIdea = function(idea, callback){
        $.ajax({
            type: "POST",
            url: URL.addIdea,
            data: {
                "idea": idea
            },
            success: callback
        });
    };
    
    var getIdeaForTask = function(data){
        var ideas = JSON.parse(data)
        
        if(!ideas.length){
            alert("No other ideas were submitted yet. Check again later.");
        } else {
            var ideaContainer = $("#ideas-container");
            ideaContainer.empty(); // clear container
            var ids = [];
            for(var i = 0; i < ideas.length; i++){
                var idea = ideas[i];
                if(ideas.length > 1)
                    ideaContainer.append($("<h4></h4>").text("Idea #" + (i+1)))
                ideaContainer.append($("<p class='quote'></p>").text(idea.idea));
                ids.push(idea.id);
            }

            $("#idea-id").val(JSON.stringify(ids));             
            $(".toggle").toggleClass("hidden");
        }
    };

    var rateIdea = function(){
        var originalityInput = $("input[name=originality]:checked");
        var usefulnessInput = $("input[name=usefulness]:checked");
        var similarityInput = $("input[name=similarity]:checked");
        // The idea has been rated
        $(".toggle").toggleClass("hidden");
        originalityInput.prop("checked", false);
        usefulnessInput.prop("checked", false);
        similarityInput.prop("checked", false)
    };

    var finishSession = function(){
        $("#time-over").show();
    };

    var surveyIsValid = function(){
        isValid = false;
        var usefulInspiration = $("#survey input[name=useful-inspiration]:checked").val();
        var openEnded = $("#survey textarea").val();

        if(!usefulInspiration || (!openEnded || openEnded.length > 1000)){
            isValid = false;
        } else {
            isValid = true;
        }
        return isValid;
    };

    var getCodeClick = function(){
        if(ENV.condition == 1){
            // Condition 1 has no survey. Get code.
            getCode();
        } else if(surveyIsValid()){
            // Post survey to server
            var usefulInspiration = $("#survey input[name=useful-inspiration]:checked").val();
            var openEnded = $("#survey textarea").val();
            $.ajax({
                type: "POST",
                url: URL.postSurvey,
                data: {usefulInspiration:usefulInspiration, openEnded:openEnded},
                success:function(data){

                }
            });   
            // Get code and display it
            getCode();
        } else {
            alert("Please, fill in all questions in the survey before clicking this button!");
        }
    };

    var getCode = function(){
        $.ajax({
            type: "GET",
            url: URL.getFinalID,
            success:function(data){
                $("#final-id").css("display", "block").text(data);
            }
        });
    }

    $(".tooltip-toggle").tooltip(); // Tooltip
});