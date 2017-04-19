class TasksView extends View {
    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        console.dir('Initializing Tasks view');
        // Clear container
        $(this.container).empty();
        // Issue request
        $.ajax({
            type: "GET",
            url: URL.getSuggestedTasks,
            success: (data)=>{
                this.buildView(JSON.parse(data));
            }
        });
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
        console.dir('Custom TASK Highlight idea');
        var id = e.params.id;
        var source = e.params.source;
        var ideaBlock = $(this.container + ' .id' + id);
        if(ideaBlock.length > 0){
            // Highlight it
            ideaBlock.addClass('ideaHover');
            // If hovering for over a given threshold of time, scroll down to the idea
            if(source && !(this instanceof source)){
                this.hoverTimeout = window.setTimeout(()=>{ // Wait
                    var parentContainer = $(this.container).parent(); // This is the scroll container element
                    var taskBlock = ideaBlock.parent(); // This is the task block that will be scrolled to
                    var scrollTo = taskBlock.offset().top - parentContainer.offset().top + parentContainer.scrollTop();
                    parentContainer.animate({
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
        console.dir('Custom TASK Blur idea');
        var id = e.params.id;
        // Remove highlight
        $(this.container + ' .id' + id).removeClass('ideaHover');
        // Cancel timeout
        clearTimeout(this.hoverTimeout);
    }

    /*
    Having the tasks data, this function builds the actual view
    */
    buildView(structure){
        var tasksList = $(this.container);
        for(var i = 0; i < structure.length; i++){
            var type = structure[i].type;
            var idea = {
                idea: structure[i].idea, 
                id: structure[i].idea_id, 
                suggestedTags: structure[i].suggested_tags,
                chosenTags: structure[i].chosen_tags,
            };
            var params = {closeable: false, focuseable: true, source: this.constructor}
            var taskItem;
            var ideaElement = new Idea(idea, params);
            if(type === 'rating'){
                // Rating task
                taskItem = $("<li></li>").html(Mustache.render(TEMPLATES.ratingTaskTemplate, idea));
            } else if(type === 'suggest'){
                // Suggest category task
                var template = $(Mustache.render(TEMPLATES.suggestTaskTemplate, idea));
                taskItem = $("<li></li>").html(template);
                // Setup
                
            } else if(type === 'selectBest' || type === 'categorize'){
                // select best or categorize tasks
                var template = $(Mustache.render(TEMPLATES[type + 'TaskTemplate'], idea));
                var tagsList = type === 'selectBest' ? idea.suggestedTags : idea.chosenTags;
                taskItem = $("<li></li>").html(template);
                // Add labels
                tagsList.forEach(function(d,j){
                    var tag = $(Mustache.render(TEMPLATES.tagTemplate, {tag:d}));
                    $('.tagsList', taskItem).append($("<li></li>").html(tag));
                    tag.click(function(event){
                        var parent = $(this).closest('.tagsList');
                        if (parent.hasClass('single')){
                            // This list supports only one selected tag. Unselect currently selected tags.
                            $('.selected', parent).removeClass('selected');
                        }
                        $(this).toggleClass('selected');
                    });
                });
            } 
            // Finish setting up idea in the template
            $('#ideaPlaceholder', taskItem).replaceWith(ideaElement.html());
            $('.ideaBlock', taskItem).css('display', 'block');
            taskItem.attr('id', 'task-' + structure[i].id);
            // Set submit handlers
            var submitHandler = {
                'rating': (e)=>{ this.submitRatingTask(e) },
                'suggest': (e)=>{ this.submitSuggestTask(e) },
                'selectBest': (e)=>{ this.submitCategorizationTask(e) },
                'categorize': (e)=>{ this.submitCategorizationTask(e) },
            };
            $('.btn', taskItem).click(submitHandler[type]);
            // Dramatic entrance
            taskItem.css('display','none');
            tasksList.append(taskItem);
            taskItem.fadeIn();
            // Setup input tag. For some reason, it doesn't work before element is visible. TODO figure better workaround
            $('[name=tagInput]', tasksList).tagsInput(ENV.tagConfig);
        }
    }

    /*
    Submits a rating task
    */
    submitRatingTask(event){
        var taskContainer = $(event.target).parent('li');
        var ideaBlock = $('.ideaBlock', taskContainer);
        var data = {
            idea_id: $('input[name=ideaId]',ideaBlock).val(),
            originality: $('[name=originality]:checked',taskContainer).val(),
            usefulness: $('[name=usefulness]:checked',taskContainer).val()
        };
        // Submit
        var _this = this;
        var successHandler = function(data){
            _this.closeTask(taskContainer);
        };
        $.ajax({
            type: "POST",
            url: URL.submitRatingTask,
            data: data,
            success: successHandler,
            error: function(){
                $.web2py.flash('Something went wrong!', 'error');
            }
        });
    };

    /*
    Submits a suggest tag task
    */
    submitSuggestTask(event){
        // Collect data
        var taskContainer = $(event.target).parent('li');
        var ideaBlock = $('.ideaBlock', taskContainer);
        var tags = $('input[name=tagInput]', taskContainer).val().split(ENV.tagsDelimiter);
        var containerId = taskContainer.attr('id');
        if(tags.length < ENV.minNumberTags){
            UTIL.insertErrorMessage('#' + containerId + ' input[name=tagInput]', 'You must suggest at least 3 tags!', 'error-tag-' + containerId);
        } else {
            // Has enough tags
            var data = {
                idea_id: $('input[name=ideaId]',ideaBlock).val(),
                suggested_tags: tags,
                type: 'suggest'
            };
            // Submit
            var _this = this; 
            $.ajax({
                type: "POST",
                url: URL.submitCategorizationTask,
                data: data,
                success: (data)=>_this.closeTask(taskContainer),
                error: function(){
                    $.web2py.flash('Something went wrong!', 'error');
                }
            });
        }
        
    };

    /*
    Submits a categorize task
    */
    submitCategorizationTask(event) {
        // Collect data
        var taskContainer = $(event.target).parent('li');
        var ideaBlock = $('.ideaBlock', taskContainer);
        var chosenTags = [];
        $('.selected', taskContainer).each(function(index, el){
            chosenTags.push($(el).text());
        });
        var data = {
            idea_id: $('input[name=ideaId]',ideaBlock).val(),
            chosen_tags: chosenTags,
            type: $('[name=taskType]', taskContainer).val()
        };
        // Submit
        var _this = this;
        $.ajax({
            type: "POST",
            url: URL.submitCategorizationTask,
            data: data,
            success: function(data){
                _this.closeTask(taskContainer);
            },
            error: function(){
                $.web2py.flash('Something went wrong!', 'error');
            }
        });
    };

    /*
    Removes a task from the view
    */
    closeTask(container){
        $.web2py.flash('Task successfully submitted!', 'ok');
        container.hide(300, function(){
            container.remove();
        })
        // Trigger event
        $.event.trigger({type:EVENTS.taskSubmitted, params:{}});
    };

}
