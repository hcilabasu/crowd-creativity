/*
* Depends on:
* - URL.addIdea
* - URL.getNewIdeas
* - DATA.userCategories
* - ENV.condition
*/

$(function(){

    var maxCatCharacters = 20;
    var maxIdeaCharacters = 20;
    var validationError = false;

    var userIdeaCounter = 0;
    var lastUpdateTime = null;
    var othersIndex = 0;
    
    $("#idea-submit").click(function(e){
        // get inputs
        var ideaInput = $("#idea-input");
        var cat1Input = $("#category1");
        var cat2Input = $("#category2");
        // get their content
        var text = ideaInput.val();
        var category1 = cat1Input.val().trim();
        var category2 = cat2Input.val().trim();
        if(category1) DATA.userCategories.add(category1);
        if(category2) DATA.userCategories.add(category2);

        if(!text){
            alert("The idea text is mandatory!");
            validationError = true;
        } else if (text.length > 1000){
            alert("You can use at most " + maxIdeaCharacters + " characters in your idea");
        }
        if(!category1){
            alert("The first tag is mandatory");
            validationError = true;
        }
        if(category1.length > maxCatCharacters || category2.length > maxCatCharacters){
            alert("Tags can only have at most " + maxCatCharacters + " characters");
            validationError = true;
        }
        
        if(!validationError){
            // clear inputs
            ideaInput.val("");
            cat1Input.val("");
            cat2Input.val("");

            // Increase idea counter
            userIdeaCounter++;
            
            // Send idea to server
            addIdea("", text, category1, category2, function(){
                // Add idea to user's view
                $("#no-user-idea").remove();
                $("#user-ideas").prepend("<li class='list-group-item'><p>" + text + "</p></li>")    
            });
        }
        
        
    });

    $("#getHint").click(function(){

        $.ajax({
            type: "GET",
            url: URL.getCategory,
            success: addCategory
        });

    });
    
    var addIdea = function(userId, idea, category1, category2, callback){
        $.ajax({
            type: "POST",
            url: URL.addIdea,
            data: {
                "idea": idea,
                "category1": category1,
                "category2": category2
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

    var addCategory = function(result){
        category = JSON.parse(result);
        // add to set
        DATA.userCategories.add(category.category);
        // Update table
        $("#col-" + category.id + " span").text(category.category);
        $("#row-" + category.id).text(category.category);
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
    };
    
    if(ENV.condition !== 3){
        // Get others' ideas and start interval
        getNewIdeas(updateOthersIdeas);
        window.setInterval(function(){
            getNewIdeas(updateOthersIdeas);
        }, 10000);
    }

    $(".tooltip-toggle").tooltip(); // Tooltip
});

