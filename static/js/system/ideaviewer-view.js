class IdeaViewerView extends View {

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        this.loadIdeasAddedBy(ENV.userId);
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
        var id = e.params.id;
        var source = e.params.source;
        // Highlight
        var ideaBlock = $(this.container + ' .id' + id);
        if(ideaBlock.length > 0) {
            ideaBlock.addClass('ideaHover');
            // If hovering for over a given threshold of time, scroll down to the idea
            // But first, checking if source is not the idea viewer itself
            if(source && !(this instanceof source)){
                this.hoverTimeout = window.setTimeout(()=>{ // Wait
                    var container = $(this.container); 
                    var scrollTo = ideaBlock.offset().top - container.offset().top + container.scrollTop();
                    container.animate({
                        scrollTop: scrollTo
                    }, ENV.scrollSpeed);
                }, ENV.scrollDelay);
            }
        }
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        var id = e.params.id;
        // Remove highlight
        $(this.container + ' .id' + id).removeClass('ideaHover');
        // Cancel hover timer
        clearTimeout(this.hoverTimeout);
    }

    /*
    Highlight ideas that have particular tags
    */
    highlightTagsHandler(e){
        var tags = e.params.tags;
        $(this.container + ' ' + tags.join('')).addClass('ideaHover');
    }

    /*
    Blur ideas that have particular tags
    */
    blurTagsHandler(e){
        $(this.container + ' .ideaHover').removeClass('ideaHover');
    }

    loadFavoriteIdeas(){
        // Clear panel
        $(this.container).empty();
        // Load ideas
        this.getParentContainer().addClass('loading');
        $.ajax({
            type: "GET",
            url: URL.getUserIdeas,
            data: {is_favorite: true},
            success: (data)=>{
                var ideas = JSON.parse(data);
                this.updateIdeaCounter(ideas.length);
                for (var i = 0; i < ideas.length; i++) {
                    this.addIdeaToDisplay(ideas[i]);
                }
                this.getParentContainer().removeClass('loading');
            }
        });
    }

    loadIdeasAddedBy(userId){
        // Clear panel
        $(this.container).empty();
        // Load ideas
        this.getParentContainer().addClass('loading');
        var params = {};
        if (userId) {
            params.added_by = userId;
        }
        $.ajax({
            type: "GET",
            url: URL.getUserIdeas,
            data: params,
            success: (data)=>{
                var ideas = JSON.parse(data);
                this.updateIdeaCounter(ideas.length);
                for (var i = 0; i < ideas.length; i++) {
                    this.addIdeaToDisplay(ideas[i]);
                }
                this.getParentContainer().removeClass('loading');
            }
        });
    }

    /* Updates the idea counter */
    updateIdeaCounter(count){
        var text = '<span>1</span> idea loaded';
        if(count !== 1){
            text = '<span>' + count + '</span> ideas loaded';
        }
        $('#ideasContainerCounter').html(text);
    }

    /* Retrieves the counter number */
    getIdeasCounterNumber(){
        var value = $('#ideasContainerCounter > span').text();
        if(isNaN(value)){
            return 0;
        } else {
            return parseInt(value);
        }
    }

    /* 
    Adds an idea to the view 
    */
    addIdeaToDisplay(idea, updateCounter){
        var params = {
            closeable:true, 
            draggable:true, 
            resizable: true, 
            focuseable: true, 
            editable: true, 
            source: this.constructor
        };
        var ideaElement = new Idea(idea, params);
        var ideaBlock = ideaElement.html();
        $(this.container).append(ideaBlock);
        ideaBlock.fadeIn('slow');
        if(updateCounter){
            this.updateIdeaCounter(this.getIdeasCounterNumber() + 1);
        }
    };

    closeIdea(id){
        $(this.container + ' #id'+id).hide(200, function(){ this.remove(); });
    }

    loadIdea(id){
        if($(this.container + ' #id' + id).length){
            // Idea is already in pane. Focus
            $(this.container + ' #id' + id).addClass('glow').delay(3000).queue(function(next){ $(this).removeClass('glow'); next(); });
        } else {
            // Idea is not in the pane. Retrieve and display.
            $.ajax({
                type: "GET",
                data: {id:id},
                url: URL.getIdeaById,
                success: function(data){
                    var idea = JSON.parse(data);
                    this.updateIdeaCounter(this.getIdeasCounterNumber() + 1);
                    VIEWS.ideasView.addIdeaToDisplay(idea);
                }
            });
        }
    };
}