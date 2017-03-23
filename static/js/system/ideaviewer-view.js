class IdeaViewerView extends View {

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        console.dir('Initializing View');
        // Clear panel
        $(this.container).empty();
        // Load ideas
        $.ajax({
            type: "GET",
            url: URL.getUserIdeas,
            success: (data)=>{
                var ideas = JSON.parse(data);
                for (var i = 0; i < ideas.length; i++) {
                    this.addIdeaToDisplay(ideas[i]);
                }
            }
        });
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
        console.dir('Custom IDEA Highlight idea');
        var id = e.params.id;
        $(this.container + ' .id' + id).addClass('ideaHover');
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        console.dir('Custom IDEA Blur idea');
        var id = e.params.id;
        $(this.container + ' .id' + id).removeClass('ideaHover');
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
}