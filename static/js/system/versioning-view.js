class VersioningView extends View {

    constructor(container){
        super(container);

        // Set shared variables
        this.dimensions = {
            smallIdea: 15
        };
    }

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        console.dir('Initializing Versioning View');
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
            }
        });
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
        console.dir('Custom VERSIONING Highlight idea');
		var id = e.params.id; 
		var ideas = $('.' + ENV.idPrefix + id, this.getParentContainer());
		ideas.addClass('hover');
		// If hovering for over a given threshold of time, scroll down to the idea
		// this.hoverTimeout = window.setTimeout(()=>{ // Wait
		// 	var container = $(this.container); // This is the scroll container element
		// 	if(idea.nodes().length > 0){
		// 		var taskBlock = $(idea.nodes()[0]); // This is the task block that will be scrolled to
		// 		var scrollTo = taskBlock.offset().top - container.offset().top + container.scrollTop();
		// 		container.animate({
		// 			scrollTop: scrollTo - 30 // padding
		// 		}, ENV.scrollSpeed);
		// 	}
		// }, ENV.scrollDelay);
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        console.dir('Custom VERSIONING Blur idea');
        var id = e.params.id;
        var ideas = $('.' + ENV.idPrefix + id, this.getParentContainer());
		ideas.removeClass('hover');
		// Clear timeout
		clearTimeout(this.hoverTimeout);
	}
	
	/*
    Highlight ideas that have particular tags
    */
	highlightTagsHandler(e){
		console.dir('Custom VERSIONING Highlight tags');
		var tags = e.params.tags; 
		var ideas = $(tags.join(''), this.getParentContainer());
		ideas.addClass('hover');
	}

	/*
	Blur ideas that have particular tags
	*/
	blurTagsHandler(e){
		console.dir('Custom VERSIONING Blur tags'); 
		var ideas = $('.hover', this.getParentContainer());
		ideas.removeClass('hover');
	}

	/*
    Build the visualization
    */
    buildVersioningPanel(structure){
		if(structure.length > 0){
			var html = '';
			// Build view
			for(var i = 0; i < structure.length; i++){
				var nodeHtml = this.buildTree(structure[i]);
				html += nodeHtml;
			}
			$('.treeView', this.getParentContainer()).html(html);
			var nodes = $('.treeView .node');
			var _this = this;
			nodes.each(function(i,d){
				_this.setupLines($(d));
			});
			// Attach hover event handlers
			$('.treeView .smallIdea').hover(function(e){
				var idea = $(e.target);
				var id = idea.data('id');
				var tags = idea.data('tags').split(',');
				$.event.trigger({type:EVENTS.highlightIdea, params:{
					id: id,
					tags: tags
				}});
			}, function(e){
				console.dir('>>>> BLUR');
				var idea = $(e.target);
				var id = idea.data('id');
				var tags = idea.data('tags').split(',');
				$.event.trigger({type:EVENTS.blurIdea, params:{
					id: id,
					tags: tags
				}});
			});
		} else {
			this.getParentContainer().addClass('empty');
		}
		this.getParentContainer().removeClass('loading');
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
					top: childCenter.top + ((baseCenter.top - childCenter.top) / 2),
				}
				line.offset({
					top: midPoint.top, 
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
				line.css('transform', 'rotate('+angle+'deg)');
			} else {
				line.hide();
			}		
		}
	}
};
