var config = {
    dimensions: {
        borderWidth: 5
    },
    content: [{
        type: 'row',
        content:[{
            type: 'column',
            width: 60,
            content: [{
                type: 'component',
                title: 'Idea viewer',
                height: 50,
                isClosable: false,
                componentName: 'ideaViewer',
                componentState: { } 
            },            {
                type: 'component',
                title: 'Solution space',
                isClosable: false,
                componentName: 'other',
                componentState: { } 
            }]
            
        },{
            type: 'column',
            content:[{
                type: 'component',
                title: 'Versioning',
                height: 60,
                isClosable: false,
                componentName: 'versioning',
                componentState: { }
            },{
                type: 'component',
                title: 'Suggested tasks',
                isClosable: false,
                componentName: 'other',
                componentState: { }
            }]
        }]
    }]
};

var layoutContainer = $("#layoutContainer");
var LAYOUT = new GoldenLayout(config);

LAYOUT.registerComponent( 'ideaViewer', function( container, componentState ){
    container.getElement().html(Mustache.render(TEMPLATES.ideaViewerTemplate));
});

LAYOUT.registerComponent( 'versioning', function( container, componentState ){
    container.getElement().html(Mustache.render(TEMPLATES.versioningViewerTemplate));
});

LAYOUT.registerComponent( 'other', function( container, componentState ){
    container.getElement().html(componentState.label);
});