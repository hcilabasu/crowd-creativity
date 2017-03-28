class IdeaViewerView extends View {

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        console.dir('Initializing View');
        this.loadIdeasAddedBy(ENV.userId);
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
        console.dir('Custom IDEA Highlight idea');
        var id = e.params.id;
        // Highlight
        var ideaBlock = $(this.container + ' .id' + id);
        if(ideaBlock.length > 0) {
            ideaBlock.addClass('ideaHover');
            // If hovering for over a given threshold of time, scroll down to the idea
            this.hoverTimeout = window.setTimeout(()=>{ // Wait
                var container = $(this.container); 
                var scrollTo = ideaBlock.offset().top - container.offset().top + container.scrollTop();
                container.animate({
                    scrollTop: scrollTo
                }, ENV.scrollSpeed);
            }, ENV.scrollDelay);
        }
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        console.dir('Custom IDEA Blur idea');
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
        console.dir('Custom IDEA Highlight tags');
        var tags = e.params.tags;
        $(this.container + ' ' + tags.join('')).addClass('ideaHover');
    }

    /*
    Blur ideas that have particular tags
    */
    blurTagsHandler(e){
        console.dir('Custom IDEA Blur tags');
        $(this.container + ' .ideaHover').removeClass('ideaHover');
    }

    loadIdeasAddedBy(userId){
        // Clear panel
        $(this.container).empty();
        // Load ideas
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
                for (var i = 0; i < ideas.length; i++) {
                    this.addIdeaToDisplay(ideas[i]);
                }
            }
        });
    }

    /* 
    Adds an idea to the view 
    */
    addIdeaToDisplay(idea){
        var params = {closeable:true, draggable:true, resizable: true, focuseable: true};
        var ideaElement = new Idea(idea, params);
        var ideaBlock = ideaElement.html();
        $(this.container).append(ideaBlock);
        ideaBlock.fadeIn('slow');
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
                    VIEWS.ideasView.addIdeaToDisplay(idea);
                }
            });
        }
    };
}