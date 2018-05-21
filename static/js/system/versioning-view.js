class VersioningView extends View {

    constructor(container){
        super(container);

        // Set shared variables
        this.dimensions = {
            smallIdea: 15
		};
		// Create markers queue
		this.markersQueue = [];
    }

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        // Clear Panel
		$(this.container).html(Mustache.render(TEMPLATES.innerVersioningViewerTemplate));
		this.getParentContainer().addClass('loading');
		this.getParentContainer().removeClass('empty');
		this.setNeedsUpdate(false);
        // Load panel
        $.ajax({
            type: "GET",
            url: URL.getVersioningStructure,
            success: (data)=>{
				this.buildVersioningPanel(data);
				// Setup scroll marker
				$('.treeView', $(this.container)).scrollMarker().init({
					width: '10px'
				});
            }
		});
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
		var id = e.params.id; 
		var ideas = $('.' + ENV.idPrefix + id, this.getParentContainer());
		ideas.addClass('hover');
		// Add markers
        this.addMarkers(ideas);
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        var id = e.params.id;
        var ideas = $('.' + ENV.idPrefix + id, this.getParentContainer());
		ideas.removeClass('hover');
		// Clear markers
        this.clearMarkers(this.markersQueue.shift());
	}
	
	/*
    Highlight ideas that have particular tags
    */
	highlightTagsHandler(e){
		var tags = e.params.tags; 
		var ideas = $(tags.join(''), this.getParentContainer());
		ideas.addClass('hover');
		// Add markers
        this.addMarkers(ideas);
	}

	/*
	Blur ideas that have particular tags
	*/
	blurTagsHandler(e){
		var ideas = $('.hover', this.getParentContainer());
		ideas.removeClass('hover');
		// Clear markers
		this.clearMarkers(this.markersQueue.shift());
	}

	addMarkers(elements){
		var markers = $('.treeView', $(this.container)).scrollMarker().addMarkers(elements, {
            markerColor: '#FFDE78',
			fade: true
		});
		// Add to queue
		this.markersQueue.push(markers);
	}

	/*
	Clears the scroll markers
	*/
	clearMarkers(markers){
		window.setTimeout(()=>{
			$('.treeView', $(this.container)).scrollMarker().clear({
				fade: false,
				markers: markers
			});
		},0); // TODO increase timer to enable delayed fade
	}

	/*
    Build the visualization
    */
    buildVersioningPanel(structure){
		if(structure.length > 0){
			var html = '<div class="header">\
				<h3>Latest version</h3>\
				<h3>Previous versions</h3>\
			</div>';
			// Build view
			for(var i = 0; i < structure.length; i++){
				var nodeHtml = this.buildTree(structure[i]);
				html += nodeHtml;
			}
			$('.treeView', this.getParentContainer()).html(html);
			var nodes = $('.treeView .node');
			var _this = this;
			nodes.each(function(i,d){
				// Setup lines
				_this.setupLines($(d));
			});
			// Attach event handlers
			$('.treeView .smallIdea').hover(function(e){
				var idea = $(e.target);
				var id = idea.data('id');
				var tags = idea.data('tags').toString().split(',');
				$.event.trigger({type:EVENTS.highlightIdea, params:{
					id: id,
					tags: tags
				}});
			}, function(e){
				var idea = $(e.target);
				var id = idea.data('id');
				var tags = idea.data('tags').toString().split(',');
				$.event.trigger({type:EVENTS.blurIdea, params:{
					id: id,
					tags: tags
				}});
			}).click(function(e){
				// Open idea on click
				var ideaId = $(this).data('id');
				VIEWS['ideasView'].loadIdea(ideaId);
			});
			$('.treeView').append($('<div></div>', {
				class: 'fade'
			}));
		} else {
			this.getParentContainer().addClass('empty');
		}
		this.getParentContainer().removeClass('loading');
		// Hide legend on hover
		$(this.container).hover(()=>{
			$(this.container + ' .legend').stop().fadeOut('fast');
		},()=>{
			$(this.container + ' .legend').stop().fadeIn('fast');
		});
	}

	buildTree(node){
		// Build this node's html
		var tags = node.tags.map(function(el){
			return ENV.classPrefix + el;
		});
		var nodeElements = $(Mustache.render(TEMPLATES.versioningViewNodeTemplate, {
			type: node.type,
			classTags: tags.join(' '),
			tags: node.tags,
			classId: ENV.idPrefix + node.id,
			id: node.id
		}));
		// Build children and attach to this node
		var children = '';
		if(node.children.length > 0){
			for(var i = 0; i < node.children.length; i++){
				children += this.buildTree(node.children[i]);
			}
		}
		$('.children', nodeElements).html(children);
		return nodeElements[0].outerHTML;
	}

	setupLines(node){
		// Help function
		var getCenter = function(el){
			var offset = el.offset();
			return {
				top: offset.top + (el.height() / 2),
				left: offset.left + (baseNode.width() / 2)
			};
		}
		// Setup lines for this node
		var lines = node.find(' > .line');
		var baseNode = node.find(' > .smallIdea');
		var basePosition = baseNode.offset();
		var baseCenter = getCenter(baseNode);
		var children = node.find(' > .children > .node');
		// Connect lines to children
		for(var i = 0; i < lines.length; i++){
			var child = $(children[i]);
			var line = $(lines[i]);
			if(i < children.length){
				// Calculate midPoint and place line there
				var childCenter = getCenter(child);
				var midPoint = {
					top: childCenter.top + ((baseCenter.top - childCenter.top) / 2)
				}
				line.offset({
					top: baseCenter.top, 
					left: baseCenter.left
				});
				// Calculate length of line
				var a = childCenter.left - baseCenter.left;
				var b = baseCenter.top - childCenter.top;
				var length = Math.sqrt(a*a + b*b);
				line.width(length);
				// Calculate rotation
				var opposite = b;
				var hypotenuse = length;
				var angle = (Math.asin(opposite / hypotenuse) * 180 / Math.PI) * -1;
				line.css('transform', 'rotate('+angle+'deg)').css('transform-origin', 'center left');
			} else {
				line.hide();
			}		
		}
	}
};
