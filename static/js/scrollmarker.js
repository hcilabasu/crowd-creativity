/*
    Written by Victor Girotto
    Requires: jquery, jquery.mobile
*/

$.fn.scrollMarker = function(params){
    var container = this;
    var markerContainer = $('.scroll-marker-container', container);
    var markers = [];
        /*
            Initializes the container within the marker
        */
    var init = function(params){
        // Create container
        var markerContainer = $('<div></div>', {
            class: 'scroll-marker-container',
            css: {
                position: 'absolute',
                height: '100%',
                right:'0%',
                top: '0%',
                // background: 'red'
            }
        });
        // Customize based on params
        if(params['width']){
            markerContainer.css('width', params['width']);
        }
        // Keep container fixed when scrolling
        var scroll_interval;
        container.on('scrollstart', function(){
            // From: https://medium.com/building-blocks/a-better-alternative-to-on-scroll-7d2d91000ef0
            if(scroll_interval){clearInterval(scroll_interval);};
            scroll_interval = setInterval(function(){
                var scrollTop = container.scrollTop();
                markerContainer.css('top', scrollTop + 'px');    
            },10);
        });
        container.on('scrollstop', function(){
            clearInterval(scroll_interval);
        });
        // Add to container
        container.append(markerContainer);
    };

    /*
        Params:
        * markerColor: sets the bg color of the marker
        * markerHeight: how tall the marker should be. If undefined, marker will be dynamically calculated
    */
    var addMarkers = function(elements, params){
        var markerColor = 'black',
            markerWidth = '100%',
            markerHeight = undefined,
            containerHeight = container[0].scrollHeight,
            reduceRatio = markerContainer.height() / containerHeight,
            addFn = function(marker){
                markerContainer.append(marker);
            };
        // Customize based on params
        if(params['markerColor']){
            markerColor = params['markerColor'];
        }
        if(params['markerHeight']){
            markerColor = params['markerColor'];
        }
        if(params['fade']){
            addFn = function(marker){
                marker.hide();
                markerContainer.append(marker);
                marker.fadeIn('fast');
            }
        }
        if(params['clearPrevious']){
            // Close everything be
            markerContainer.empty();
        }
        // Add a marker for each element 
        var yMap = {};
        elements.each(function(i,d){
            // Declare vars
            var el = $(d),
                y = el.offset().top + container.scrollTop() - container.offset().top;
                
            if(!(y in yMap)){ // Avoid duplicating elements in same eight
                // Calculate height if needed
                if(!markerHeight){
                    markerHeight = (el.height() * reduceRatio);
                    if(markerHeight < 5) markerHeight = 5;
                    markerHeight += 'px';
                }
                // Create marker
                var marker = $('<span></span>', {
                    class: 'scroll-marker-marker',
                    css: {
                        background: markerColor,
                        width: markerWidth,
                        height: markerHeight,
                        display: 'inline-block',
                        position: 'absolute'
                    }
                });
                // Set height based on parent offset and add to container
                reducedOffset = y * reduceRatio;
                marker.css('top', reducedOffset + 'px');
                addFn(marker);
                markers.push(marker);
                // Add to map
                yMap[y] = true;
            }
        });
        return markers;
    };

    /*
        Clears the container of any markers
        Params:
        * fade: if set to true, markers will fade instead of simply disappearing
    */
    var clear = function(params){
        var closeFn = function(){
            markerContainer.empty();
        };
        if(params['fade']){
            closeFn = function(markers){
                $('.scroll-marker-marker', markerContainer).fadeOut('fast', function(){
                    markerContainer.empty();
                });
            }
        }
        if(params['markers']){
            // If the user already supplied the function with the markers, delete them
            // TODO make this use the closeFn
            params['markers'].forEach(function(d,i){
                d.fadeOut('fast', function(){
                    d.remove();
                });
            });
        } else {
            // Close
            closeFn();
        }
    };

    return {
        init: init,
        addMarkers: addMarkers,
        clear: clear
    };
};