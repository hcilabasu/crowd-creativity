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
        var ideaParameters = {id:idea.id, addedBy:addedBy, idea:idea.idea, tags:idea.tags, closeable:params['closeable']};
        var ideaBlock = $(Mustache.render(TEMPLATES.ideaBlockTemplate, ideaParameters));
        if(idea.tags){
            idea.tags.forEach(function(d,i){
                ideaBlock.addClass('cl_' + d);
            });
        }

        // closeable
        if(params['closeable'] && typeof params['closeable'] == 'boolean'){
            $('.close', ideaBlock).click(()=>{
                var id = idea.id;
                // remove this block from the DOM
                ideaBlock.hide(200, function(){ this.remove(); });
                // Trigger blur method
                $.event.trigger({type:EVENTS.blurIdea, params:{id:id}});
            });
        }

        if(typeof params['draggable'] == 'boolean' && params['draggable']){
            ideaBlock.draggable({  
                appendTo: "parent",
                helper: "clone",
                revert: true,
                start: function(event, ui){
                    event.stopPropagation();
                    $(this).css('opacity', 0);
                },
                stop: function(event, ui){
                    event.stopPropagation();
                    $(this).css('opacity', 1);
                }
            }).droppable({
                drop: function(event, ui){
                    var idea1Element = ui.draggable;
                    var idea2Element = $(this);

                    var idea1 = {idea: idea1Element.text(), 
                                id: $('input[name=ideaId]', idea1Element).val(),
                                tags: $('input[name=ideaTags]', idea1Element).val().split(',')};
                    var idea2 = {idea: idea2Element.text(), 
                                id: $('input[name=ideaId]', idea2Element).val(),
                                tags: $('input[name=ideaTags]', idea2Element).val().split(',')};
                    event.stopPropagation();
                    openOverlay('combineIdeas', {ideas: [idea1, idea2]});
                },
                classes: {
                    'ui-droppable-hover': 'ideaDragHover'
                }
            });
        }
        
        // Resizable
        if(typeof params['resizable'] == 'boolean' && params['resizable']){
            ideaBlock.resizable({
            maxHeight: 200,
            maxWidth: 230,
            minHeight: 100,
            minWidth: 130
            });
        }
        
        // Focuseable
        if(typeof params['focuseable'] == 'boolean' && params['focuseable']){
            ideaBlock.hover(function(){
                var id = $(this).attr('id').substring(2); // Get the id (remove the 'id' prefix)
                // Trigger hover event
                $.event.trigger({type:EVENTS.highlightIdea, params:{id:id, source:params['source']}});
            },function(){
                var id = $(this).attr('id').substring(2); // Get the id (remove the 'id' prefix)
                // Trigger blur event
                $.event.trigger({type:EVENTS.blurIdea, params:{id:id, source:params['source']}});
            });
        }

        return ideaBlock;
    }
}