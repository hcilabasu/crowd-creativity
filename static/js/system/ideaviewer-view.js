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
        if(!(this instanceof source)){
            // Highlight
            var ideaBlock = $(this.container + ' .id' + id);
            ideaBlock.addClass('ideaHover');
            // Add markers
            $(this.container).scrollMarker().addMarkers(ideaBlock, {
                markerColor: '#FFDE78',
                fade: true
            });
        }
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        var id = e.params.id;
        var source = e.params.source;
        if(!(this instanceof source)){
            var ideas = $(this.container + ' .id' + id);
            // Remove highlight
            ideas.removeClass('ideaHover');
            // Cancel hover timer
            clearTimeout(this.hoverTimeout);
            // Clear markers
            $(this.container).scrollMarker().clear({
                fade: false
            });
        }
    }

    /*
    Highlight ideas that have particular tags
    */
    highlightTagsHandler(e){
        var tags = e.params.tags;
        var highlightIdeas = $(this.container + ' ' + tags.join(''));
        highlightIdeas.addClass('ideaHover');
        // Add markers
        $(this.container).scrollMarker().addMarkers(highlightIdeas, {
            markerColor: '#FFDE78',
            fade: true
        });
    }

    /*
    Blur ideas that have particular tags
    */
    blurTagsHandler(e){
        $(this.container + ' .ideaHover').removeClass('ideaHover');
        // Clear markers
        $(this.container).scrollMarker().clear({
            fade: false
        });
    }

    loadFavoriteIdeas(){
        this.resetView();
        // Load ideas
        this.getParentContainer().addClass('loading');
        $.ajax({
            type: "GET",
            url: URL.getUserIdeas,
            data: {is_favorite: true},
            success: (data)=>{
                data = JSON.parse(data);
                var ideas = data.ideas;
                var stats = data.stats;
                this.updateStats(stats);
                this.updateIdeaCounter(ideas.length);
                for (var i = 0; i < ideas.length; i++) {
                    this.addIdeaToDisplay(ideas[i]);
                }
                this.getParentContainer().removeClass('loading');
                this.updateStatusText('your favorite');
            }
        });
    }

    /*
    Loads all ideas that have the tags passed by parameter.
    If strict == true, the ideas will be returned if and only if their tags exactly match the param tags.
    Else, the idea will be returned if it has at least one of the tags
    */
    loadIdeasByTags(tags, strict){
        this.resetView();
        // Load ideas
        this.getParentContainer().addClass('loading');
        var params = {
            tags: tags,
            strict: strict,
            current_only: true
        };
        $.ajax({
            type: "GET",
            url: URL.getUserIdeas,
            data: params,
            success: (data)=>{
                data = JSON.parse(data);
                var ideas = data.ideas;
                var stats = data.stats;
                this.updateStats(stats);
                this.updateIdeaCounter(ideas.length);
                for (var i = 0; i < ideas.length; i++) {
                    this.addIdeaToDisplay(ideas[i]);
                }
                this.getParentContainer().removeClass('loading');
                this.updateStatusText(tags.join(' and '));
            }
        });
    }

    loadIdeasAddedBy(userId){
        this.resetView();
        // Load ideas
        this.getParentContainer().addClass('loading');
        var params = {};
        if (userId) {
            params.added_by = userId;
        } 
        params.current_only = true;
        $.ajax({
            type: "GET",
            url: URL.getUserIdeas,
            data: params,
            success: (data)=>{
                data = JSON.parse(data);
                var ideas = data.ideas;
                var stats = data.stats;
                this.updateStats(stats);
                this.updateIdeaCounter(ideas.length);
                for (var i = 0; i < ideas.length; i++) {
                    this.addIdeaToDisplay(ideas[i]);
                }
                this.getParentContainer().removeClass('loading');
                // TODO make this dynamic to correctly handle ideas loaded by someone other than the user
                if(userId){
                    this.updateStatusText('your');
                } else {
                    this.updateStatusText('all');
                }
            }
        });
    }

    /* Updates the idea counter */
    updateIdeaCounter(count){
        var text = '<span>1</span> idea';
        if(count !== 1){
            text = '<span>' + count + '</span> ideas';
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
    Updates the status text on the toolbar
    */
    updateStatusText(type){
        $('#loadedIdeasStatus').html('Showing <strong>' + type + '</strong> ideas');
    }

    /* 
    Adds an idea to the view 
    */
    addIdeaToDisplay(idea, updateCounter){
        window.setTimeout(()=>{
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
            // Remove invisible padding elements (fix for flex box last row)
            $(this.container + ' .invisibleIdeaBlock').remove();
            // Add element
            $(this.container).prepend(ideaBlock);        
            // Add new invisible padding elements
            var ideaBlockWidth = ideaBlock.outerWidth();
            var containerWidth = $(this.container).innerWidth();
            var numberOfFillers = containerWidth / ideaBlockWidth;
            for(var i = 0; i < numberOfFillers; i++){
                $(this.container).append($('<div></div>',{class:'invisibleIdeaBlock'}));
            }
            // Update view
            if(updateCounter){
                this.updateIdeaCounter(this.getIdeasCounterNumber() + 1);
            }
            // Add to common variable
            COMMON.openIdeas.push(idea.id);
            // Add to versioning View
            // VIEWS['versioningView'].markIdeasOpen([idea.id]);
        }, 50);
    };

    closeIdea(id){
        $(this.container + ' #id'+id).hide(200, function(){ this.remove(); });
        // Decrease counter
        this.updateIdeaCounter(this.getIdeasCounterNumber() - 1);
        // Remove from common variable
        var i = COMMON.openIdeas.indexOf(parseInt(id));
        if(i > -1){
            COMMON.openIdeas.splice(i, 1);
        }
        // Remove from versioning view
        // VIEWS['versioningView'].unmarkIdeasOpen([id]);
    }

    loadIdea(id){
        var container = $(this.container);
        var ideaElement = $(' #id' + id, container);
        if(ideaElement.length){
            // Scroll to idea and focus on it
            container.animate({
                scrollTop: ideaElement.offset().top - container.offset().top + container.scrollTop()
            }, 1000, function(){
                // Idea is already in pane. Focus
                ideaElement.addClass('shake').delay(1000).queue(function(next){ $(this).removeClass('shake'); next(); });
            });
        } else {
            // Idea is not in the pane. Retrieve and display.
            $.ajax({
                type: "GET",
                data: {id:id},
                url: URL.getIdeaById,
                success: (data)=>{
                    var idea = JSON.parse(data);
                    this.updateIdeaCounter(this.getIdeasCounterNumber() + 1);
                    VIEWS.ideasView.addIdeaToDisplay(idea);
                    this.updateStatusText('various');
                }
            });
        }
    };

    updateStats(stats) {
        var originalCounter = $('#originalCounter');
        var refinedCounter = $('#refinedCounter');
        var combinedCounter = $('#combinedCounter');

        var toggle = function(counter, number){
            if (number == 0){
                counter.addClass('noIdeas');
            } else {
                counter.removeClass('noIdeas');
            }
        }

        originalCounter.text(stats.original + ' original');
        toggle(originalCounter, stats.original);
        refinedCounter.text(stats.refined + ' refined');
        toggle(refinedCounter, stats.refined);
        combinedCounter.text(stats.combined + ' combined');
        toggle(combinedCounter, stats.combined);
    }

    resetView() {
        var container = $(this.container);
        // Clear panel
        container.empty();
        // Add scrollmarker
        container.scrollMarker().init({
            width: '10px'
        });
        // Reset common variable
        COMMON.openIdeas = [];
        // if(VIEWS['versioningView']){ // Check if view is loaded
        //     VIEWS['versioningView'].clearOpenIdeas();
        // }
        // Reset status
        $('#loadedIdeasStatus').empty();
    }
}