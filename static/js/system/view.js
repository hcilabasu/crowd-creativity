class View {

    constructor(container){
        this.container = container;

        // Handle events
        $(document).on('highlightIdea', (e)=>this.highlightIdeaHandler(e));
        $(document).on('blurIdea', (e)=>this.blurIdeaHandler(e));
        $(document).on('highlightTags', (e)=>this.highlightTagsHandler(e));
        $(document).on('blurTags', (e)=>this.blurTagsHandler(e));
    }

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        console.dir('Initializing View');
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
        console.dir('Highlight idea');
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        console.dir('Blur idea');
    }

    /*
    Highlight ideas that have particular tags
    */
    highlightTagsHandler(e){
        console.dir('Highlight tags');
    }

    /*
    Blur ideas that have particular tags
    */
    blurTagsHandler(e){
        console.dir('Blur tags');
    }


};

