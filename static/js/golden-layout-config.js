var config = {
    settings: {
        hasHeaders: false,
    },
    dimensions: {
        borderWidth: 5
    },
    content: [{
        type: 'row',
        content:[{
            type: 'column',
            width: 66,
            content: [{
                id: 'ideaViewer',
                type: 'component',
                title: 'Idea viewer',
                // height: 50,
                isClosable: false,
                componentName: 'ideaViewer',
                componentState: { } 
            }/*, {
                type: 'column',
                content:[{
                    id: 'versioningView',
                    type: 'component',
                    title: 'Versioning',
                    isClosable: false,
                    componentName: 'versioning',
                    componentState: { }
                }]
            }*/]
        },{
            id: 'solutionSpace',
            type: 'component',
            title: 'Solution space',
            isClosable: false,
            componentName: 'solutionSpace',
            componentState: { } 
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