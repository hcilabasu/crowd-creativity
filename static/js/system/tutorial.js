// This depends on jQuery

class Tutorial {

    constructor(settings,steps) {
        this.settings = settings;
        this.steps = steps;

        this.nonHighlightPopUpWidth = 450;
        this.highlightPopUpWidth = 300;
    }

    /*
    Starts the tutorial
    */
    start(){
        // Add overlay 
        var overlay = $('<div></div>').attr({
            id: 'tutorialOverlay'
        });
        $('body').append(overlay);
        overlay.fadeIn('fast');
        // Bind click on overlay to stop method
        overlay.click((e)=>{
            if($(e.target).attr('id') == 'tutorialOverlay'){
                this.stop();
            }
        });
        // Load step 0
        this.currentStep = 0;
        this.loadStep();
    }

    /*
    Stops the tutorial
    */
    stop() {
        $('#tutorialOverlay').fadeOut('fast', function(){
            $(this).remove();
            $('#tutorialHighlightClone').remove();
        });
        // Execute on close function if exists
        if (this.settings.onclose !== undefined){
            this.settings.onclose();
        }
    }

    /* 
    Moves to the next step 
    */
    next(){
        this.currentStep += 1;
        // If you've gone through all steps, quit the tutorial
        if(this.currentStep < this.steps.length){
            this.loadStep();
        } else {
            this.stop();
        }
    }

    /*
    Moves to the previous step
    */
    previous(){
        this.currentStep -= 1;
        this.loadStep();
    }

    /*
    Loads the step
    */
    loadStep() {
        var step = this.steps[this.currentStep];
        // Remove temporary styles
        // this.clearStyles();
        $('#tutorialHighlightClone').fadeOut('fast', function(){ $(this).remove(); });
        // Removes previous popup
        this.destroyPopup();
        // Create clone for positioning above overlay.
        // A clone is necessary to avoid issues with stacking context
        // that can appear if you just change the z-index
        if('highlight' in step){
            var highlightOriginal = $(step.highlight);
            var highlightClone = highlightOriginal.clone(); 
            // Put all styles into the new object
            highlightClone[0].style.cssText = document.defaultView.getComputedStyle(highlightOriginal[0], '').cssText;
            // Update required styles
            highlightClone.css({
                'z-index': 3000,
                'box-shadow': '0 0 5px rgba(0,0,0,0.2);',
                'position':'absolute',
                'left':$(step.highlight).offset().left + 'px',
                'top':$(step.highlight).offset().top + 'px',
                'margin': 0,
                'display':'none'
            }).attr({
                id: 'tutorialHighlightClone'
            });
            $('#tutorialOverlay').append(highlightClone);
            highlightClone.fadeIn('fast');
        }
        this.createPopup();
    }

    /*
    Creates the popup and appends it to the correct place
    */
    createPopup(){
        var step = this.steps[this.currentStep];
        var popup = $('<div></div>').attr({
            id: 'tutorialPopUp'
        });
        // Create header and html container
        popup.append($('<h2></h2>').text(step.title));
        popup.append($('<div></div>').html(step.html));
        // Create the footer with the appropriate links
        var footerContainer = $('<div></div>').attr({
            id: 'tutorialPopUpFooter'
        });
        // Set footer according to state
        if (this.currentStep > 0){
            var previous = footerContainer.append($('<a>Previous</a>').click((e)=>this.previous()).attr({
                id: 'tutorialPopUpPrevious'
            }));
            footerContainer.append(previous);
        }
        var current = $('<span></span>').text((this.currentStep + 1) + '/' + this.steps.length).attr({
            id: 'tutorialPopUpCurrent'
        });
        var next = $('<a></a>').click((e)=>this.next()).attr({
            id: 'tutorialPopUpNext'
        });
        next.text((this.currentStep+1 < this.steps.length) ? 'Next' : 'Close');
        // Add to popup
        footerContainer.append(current);
        footerContainer.append(next);
        popup.append(footerContainer);
        // Set styles specific to with/without a highlighted element
        if (!('highlight' in step)){
            // No element is supposed to be highlighted
            popup.css('width', this.nonHighlightPopUpWidth + 'px');
            popup.addClass('noHighlight');
        } else {
            popup.removeClass('noHighlight');
            // There is an element being highlighted. Set the location specified by the user
            var highlighElement = $(step.highlight);
            var setPosition = (loc, stepLocation)=>{
                var location = stepLocation
                var key; // This can only be left or top.
                switch(loc){
                    case 'left':
                        key = 'left';
                        location = highlighElement.offset().left - (location + this.highlightPopUpWidth);
                        break;
                    case 'right':
                        key = 'left';
                        location += highlighElement.offset().left + highlighElement.outerWidth();
                        break;
                    case 'top':
                        key = 'top';
                        location = highlighElement.offset().top - (location);
                        break;
                    case 'bottom':
                        key = 'top';
                        location += highlighElement.offset().top + highlighElement.outerHeight();
                        break;
                }
                popup.css(key, location);
            };
            for(var loc in step.location){
                // Bind
                highlighElement.on('scroll resize', function(e){
                    setPosition(loc, step.location[loc]);
                });
                // Run the first time
                setPosition(loc, step.location[loc]);                
            }
            popup.css('position', 'absolute');
            popup.css('width', this.highlightPopUpWidth + 'px');
        }
        // Add to DOM and show
        popup.hide();
        $('#tutorialOverlay').append(popup);
        popup.fadeIn('fast');
    }

    /*
    Utterly destroys the popup!
    */
    destroyPopup(){
        $('#tutorialPopUp').fadeOut('fast', function(){
            $(this).remove();
        });
    }
    
}
