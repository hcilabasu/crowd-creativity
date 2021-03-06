class View {

    constructor(container){
        this.container = container;
        $(this.container).closest('.lm_stack').addClass('stack_' + this.constructor.name);
        // Handle events
        $(document).on(EVENTS.highlightIdea, (e)=>this.highlightIdeaHandler(e));
        $(document).on(EVENTS.blurIdea, (e)=>this.blurIdeaHandler(e));
        $(document).on(EVENTS.highlightTags, (e)=>this.highlightTagsHandler(e));
        $(document).on(EVENTS.blurTags, (e)=>this.blurTagsHandler(e));
    }

    /*
    Empties the container and initializes the view inside of it
    */
    load(){}

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){}

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){}

    /*
    Highlight ideas that have particular tags
    */
    highlightTagsHandler(e){}

    /*
    Blur ideas that have particular tags
    */
    blurTagsHandler(e){}

    /*
    Gets the parent container for the view
    */
    getParentContainer(){
        return $(this.container).parent();
    }

    /*
    Toggles the update badge in the view
    */
   setNeedsUpdate(needsUpdate){
        var container = this.getParentContainer();
        if(needsUpdate){
            container.addClass('update');
        } else {
            container.removeClass('update');
        }
   }
};

