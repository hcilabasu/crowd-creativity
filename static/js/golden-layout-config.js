var config = {
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
                height: 40,
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

/* The config argument is required. A DOM element can be provided as optional second argument. 
If none is specified GoldenLayout takes over the entire page by adding itself to document.body */
var layoutContainer = $("#layoutContainer")[0];

var myLayout = new GoldenLayout(config, layoutContainer);

myLayout.registerComponent( 'ideaViewer', function( container, componentState ){
    container.getElement().html('<div id="ideasContainer"></div>');
});


myLayout.registerComponent( 'versioning', function( container, componentState ){
    container.getElement().html('<div id="versioningContainer"></div>');
});


myLayout.registerComponent( 'other', function( container, componentState ){
    container.getElement().html(componentState.label);
});

$(function(){
    // Initialize layout
    myLayout.init();
});