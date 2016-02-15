/*
* Depends on:
* - URL.addIdea
* - URL.getNewIdeas
*/

$(function(){

    var userIdeaCounter = 0;
    var lastUpdateTime = null;
    var othersIndex = 0;
    
    $("#idea-submit").click(function(e){
        var ideaInput = $("#idea-input");
        var text = ideaInput.text();
        ideaInput.empty();
        
        // TODO Validation
        
        // Increase idea counter
        userIdeaCounter++;
        
        // Send idea to server
        addIdea("", text, function(){
            // Add idea to user's view
            $("#no-user-idea").remove();
            $("#user-ideas").prepend("<li class='list-group-item'><p>" + text + "</p></li>")    
        });
        
        
    });
    
    var addIdea = function(userId, idea, callback){
        $.ajax({
            type: "POST",
            url: URL.addIdea,
            data: {
                "idea": idea
            },
            success: callback
        });
    };
    
    var getNewIdeas = function(callback){
        $.ajax({
            type: "POST",
            url: URL.getNewIdeas,
            data: {
              lastUpdateTime: lastUpdateTime  
            },
            success: callback
        })
    };
    
    var updateOthersIdeas = function(data){
        var parsedData = JSON.parse(data);
        lastUpdateTime = parsedData.lastUpdate; // Update last update time
        var ideas = parsedData.ideas;
        // Remove placeholder
        if (ideas.length > 0)
            $("#no-group-idea").remove();
        // Add ideas
        for(var i = 0; i < ideas.length; i++){
            var idea = ideas[i];
            othersIndex++; // Increment global idea index
            $("#group-ideas").prepend("<li class='list-group-item'><p>" + idea + "</p></li>");
        }
        
        console.dir(lastUpdateTime);
    };
    
    // Get others' ideas and start interval
    getNewIdeas(updateOthersIdeas);
    window.setInterval(function(){
        getNewIdeas(updateOthersIdeas);
    }, 10000);
    
});

