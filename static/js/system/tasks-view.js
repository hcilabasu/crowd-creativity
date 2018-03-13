class TasksView extends View {
    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        // Clear container
        $('ul', this.container).empty();
        this.getParentContainer().addClass('loading');
        // Issue request
        $.ajax({
            type: "GET",
            url: URL.getAvailableTasks,
            success: (data)=>{
                this.buildView(data);
            }
        });
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
        var id = e.params.id;
        var source = e.params.source;
        var ideaBlock = $(this.container + ' .id' + id);
        if(ideaBlock.length > 0){
            // Highlight it
            ideaBlock.addClass('ideaHover');
            // If hovering for over a given threshold of time, scroll down to the idea
            if(source && !(this instanceof source)){
                this.hoverTimeout = window.setTimeout(()=>{ // Wait
                    var parentContainer = $(this.container); // This is the scroll container element
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
        var tasksList = $('ul', this.container);
        for(var i = 0; i < structure.length; i++){
            // Preparing data
            var taskId = structure[i].task.id;
            var taskType = structure[i].task.task_type;
            var idea = {
                idea: structure[i].idea.idea, 
                id: structure[i].idea.id, 
                tags: []
            };
            // Setting up HTML
            var params = {closeable: false, focuseable: true, source: this.constructor}
            var ideaElement = new Idea(idea, params);
            var templateParams = {id: taskId, type: taskType}
            var template = $(Mustache.render(TEMPLATES[taskType + 'Template'], templateParams));
            var innerForm = $('<form></form>').html(template)
            var taskItem = $("<li></li>").append(innerForm);
            // Custom processing for each task type
            this.taskTypeProcessor(taskType, innerForm).pre();
            // Finish setting up idea in the template
            $('#ideaPlaceholder', taskItem).replaceWith(ideaElement.html());
            $('.ideaBlock', taskItem).css('display', 'block');
            taskItem.attr('id', 'task-' + structure[i].id);
            $('.btn', taskItem).click((e)=>{this.submitTask(e)});
            // Dramatic entrance
            taskItem.css('display','none');
            tasksList.append(taskItem);
            taskItem.fadeIn();
            // Setup input tag. For some reason, it doesn't work before element is visible. TODO figure better workaround
            $('.tagInput', tasksList).tagsInput(ENV.tagConfig);
        }
        this.getParentContainer().removeClass('loading');
    }

    /*
    Generic task submission handler
    */
    submitTask(event){
        // Get data
        var form = $(event.target).parent('form');
        var taskContainer = form.parent('li');
        var id = $('[name=taskId]', form).val();
        var type = $('[name=taskType]', form).val();
        var answer = this.taskTypeProcessor(type, form).post();
        var data = {
            id:id,
            type:type,
            answer:answer
        };
        // Submit
        var _this = this;
        $.ajax({
            type: "POST",
            url: URL.submitTask,
            data: data,
            success: function(data){
                _this.closeTask(taskContainer);
            },
            error: function(){
                $.web2py.flash('Something went wrong!', 'error');
            }
        });
    }
    
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

    /*
    This function receives a type of task as parameter, and outputs a function for processing
    either the view compilation (pre) or answer processing (post) of specific task types. 
    pre does not return anything, but can alter the task form as required.
    post must return the final answer in JSON.
    */
    taskTypeProcessor(type, form){
        return {
            'TagSuggestionTask': {
                'pre': function(){},
                'post': function(){
                    var rawAnswer = $('[name=answer]', form).val()
                    var answer = rawAnswer.split(ENV.tagsDelimiter);
                    return JSON.stringify(answer);
                }
            },
            'TagValidationTask': {
                'pre': function(){
                    /*else if(type === 'selectBest' || type === 'categorize'){
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
                    });*/
                },
                'post': function(){}
            }
        }[type];
    }


    /*
    DEPRECATED
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
            url: URL.submitTask,
            data: data,
            success: successHandler,
            error: function(){
                $.web2py.flash('Something went wrong!', 'error');
            }
        });
    };

    /*
    DEPRECATED
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
    DEPRECATED
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

}
