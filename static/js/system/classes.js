class Idea {

    constructor(idea, params){
        this.idea = idea;
        this.params = params;
    }

    /*
    Generates the jquery element to be added to the DOM
    */
    html(){
        var idea = this.idea;
        var params = this.params;
        var addedBy = idea.userId === ENV.userId ? 'you' : 'someone else';
        // Load template
        var isFavorite = idea.favorite ? 'favorite' : '';
        var ideaParameters = {
            id:idea.id, 
            addedBy:addedBy, 
            idea:idea.idea, 
            tags:idea.tags, 
            favorite:isFavorite, 
            closeable: false /* params['closeable']*/,
            editable: params['editable']
        };
        var ideaBlock = $(Mustache.render(TEMPLATES.ideaBlockTemplate, ideaParameters));
        var innerContainer = $('.ideaBlockContainer:not(.detached)', ideaBlock);
        if(idea.tags){
            idea.tags.forEach(function(d,i){
                ideaBlock.addClass('cl_' + d);
            });
        }

        // closeable
        if(false && params['closeable'] && typeof params['closeable'] == 'boolean'){
            $('.close', ideaBlock).click(()=>{
                var id = idea.id;
                // remove this block from the DOM
                ideaBlock.hide(200, function(){ this.remove(); });
                // Trigger blur method
                $.event.trigger({type:EVENTS.blurIdea, params:{id:id}});
            });
        }

        if(typeof params['draggable'] == 'boolean' && params['draggable']){
            innerContainer.draggable({
                addClasses: false,
                handle: '.ideaBlockHeader',  
                appendTo: "#ideasContainer",
                helper: function(){
                    return $('<div></div>').text(idea.idea);
                },
                scope: 'ideas',
                revert: true,
                start: function(event, ui){
                    event.stopPropagation();
                    $(this).css('opacity', 0);
                    $(ui.helper).addClass('ideaDragHandle');
                },
                stop: function(event, ui){
                    event.stopPropagation();
                    $(this).css('opacity', 1);
                }
            });
            ideaBlock.droppable({
                drop: function(event, ui){
                    event.stopPropagation();
                    
                    var idea1Element = ui.draggable;
                    var idea2Element = $(this);

                    if(idea1Element.length >= 1 && idea2Element.length >= 1 && idea2Element.html().trim() !== ''){
                        var idea1 = {idea: idea1Element.find('.ideaBlockText').text().trim(), 
                                    id: $('input[name=ideaId]', idea1Element).val(),
                                    tags: $('input[name=ideaTags]', idea1Element).val().split(',')};
                        var idea2 = {idea: idea2Element.find('.ideaBlockText').text().trim(), 
                                    id: $('input[name=ideaId]', idea2Element).val(),
                                    tags: $('input[name=ideaTags]', idea2Element).val().split(',')};
                        if(idea1.id !== idea2.id){
                            openOverlay('combineIdeas', {ideas: [idea1, idea2]});
                        }                
                    }
                },
                addClasses: false,
                tolerance: 'pointer',
                scope: 'ideas',
                classes: {
                    'ui-droppable-hover': 'ideaDragHover'
                }
            });
        }
        
        // Resizable
        if(false && typeof params['resizable'] == 'boolean' && params['resizable']){
            ideaBlock.resizable({
                maxHeight: 200,
                maxWidth: 230,
                minHeight: 100,
                minWidth: 130
            });
        }
        
        // Focuseable
        if(typeof params['focuseable'] == 'boolean' && params['focuseable']){
            var getParams = function(that){
                var id = $(that).attr('id').substring(2); // Get the id (remove the 'id' prefix)
                // Get tags 
                var classes = $(that).attr('class').split(' ');
                var tags = [];
                for(var i = 0; i < classes.length; i++){
                    var tag = classes[i];
                    if(tag.startsWith(ENV.classPrefix)){
                        tags.push(tag.replace(ENV.classPrefix, ''));
                    }
                }
                return {
                    id:id, 
                    tags:tags, 
                    source:params['source']
                }
            };

            var outerTimeout;
            innerContainer.mouseenter(function(e){
                e.stopPropagation();
                if(!innerContainer.parent('body').length){ // if parent is NOT body
                    outerTimeout = window.setTimeout(function(){ // Have short delay before expanding idea
                        $.event.trigger({type:EVENTS.highlightIdea, params:getParams(ideaBlock)});
                        // Detach inner container and attach it to body so it can hover over everything
                        var position = innerContainer[0].getBoundingClientRect();
                        innerContainer.detach();
                        ideaBlock.css('visibility','hidden');
                        $('body').append(innerContainer);
                        innerContainer.css({
                            top: position.top,
                            left: position.left,
                            'z-index': '9999'
                        });
                        // This delay is necessary to trigger the css transition
                        window.setTimeout(function(){
                            // check if inner container is detached
                            if(innerContainer.parent('body').length){
                                innerContainer.addClass('detached');
                            }
                        }, 50);
                    }, 200);
                }
            });
            innerContainer.mouseleave(function(e){
                e.stopPropagation();
                clearTimeout(outerTimeout);
                $.event.trigger({type:EVENTS.blurIdea, params:getParams(ideaBlock)});
                // Detach from body and reattach inner container to ideaBlock
                innerContainer.detach();
                ideaBlock.css('visibility','visible');
                ideaBlock.append(innerContainer);
                innerContainer.removeClass('detached');
                innerContainer.css({
                    position: 'absolute',
                    top: '0px',
                    left: '0px',
                    'z-index': '1'
                });
            });
        } else {
            // Not focuseable
            innerContainer.addClass('expanded');
        }
        
        // Editable
        if(typeof params['editable'] == 'boolean' && params['editable']){
            $('.expandBtn', ideaBlock).click(function(){
                openOverlay('editIdea', {id: idea.id, edit:false});
            })
            $('.refineBtn', ideaBlock).click(function(){
                openOverlay('editIdea', {id: idea.id, edit:true});
            });
        }

        // Setup favorites button
        $('.favoriteBtn', ideaBlock).click(function(e){
            e.stopPropagation();
            // Proactively change appearance
            var toggleBlock = $('.' + ENV.idPrefix + idea.id + '.ideaBlockContainer');
            toggleBlock.toggleClass('favorite');
            // Send request to server
            $.ajax({
                method: 'POST',
                url: URL.addToFavorites,
                data: {id:idea.id},
                success: function(){
                }, error: function(){
                    $.web2py.flash('Something went wrong!', 'error');
                    // Remove class if fail
                    toggleBlock.removeClass('favorite');
                }
            });
        });

        // Setup close button 
        $('.hideBtn', ideaBlock).click(function(e){
            e.stopPropagation();
            ideaBlock.fadeOut('fast', function(){
                VIEWS['ideasView'].closeIdea(idea.id);
            });
        });
        return ideaBlock;
    }
}