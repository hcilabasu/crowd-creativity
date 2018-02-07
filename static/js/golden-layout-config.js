var config = {
    settings: {
        hasHeaders: false,
    },
    dimensions: {
        borderWidth: 8
    },
    content: [{
        type: 'row',
        content:[{
            type: 'column',
            width: 70,
            content: [{
                id: 'ideaViewer',
                type: 'component',
                title: 'Idea viewer',
                height: 50,
                isClosable: false,
                componentName: 'ideaViewer',
                componentState: { } 
            }, {
                id: 'solutionSpace',
                type: 'component',
                title: 'Solution space',
                isClosable: false,
                componentName: 'solutionSpace',
                componentState: { } 
            }]
            
        },{
            type: 'column',
            content:[{
                type: 'component',
                title: 'Versioning',
                //height: 45,
                isClosable: false,
                componentName: 'versioning',
                componentState: { }
            }/*,{
                id: 'suggestedTasks',
                type: 'component',
                title: 'Suggested tasks',
                isClosable: false,
                componentName: 'suggestedTasks',
                componentState: { }
            }*/]
        }]
    }]
};

var LAYOUT = new GoldenLayout(config);

LAYOUT.registerComponent( 'ideaViewer', function( container, componentState ){
    container.getElement().html(Mustache.render(TEMPLATES.ideaViewerTemplate));
});

LAYOUT.registerComponent( 'versioning', function( container, componentState ){
    container.getElement().html(Mustache.render(TEMPLATES.versioningViewerTemplate));
});

LAYOUT.registerComponent( 'suggestedTasks', function( container, componentState ){
    container.getElement().html(Mustache.render(TEMPLATES.suggestedTasksViewerTemplate));
});

LAYOUT.registerComponent( 'solutionSpace', function( container, componentState ){
    container.getElement().html(Mustache.render(TEMPLATES.solutionSpaceViewerTemplate));
    container.on('resize', function(){
        $('#solutionSpaceContainer').trigger('resize');
    });
});