class SolutionSpaceView extends View {

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
		var container = $(this.container);
        container.empty();
		$('#miniMap').hide();
		this.getParentContainer().addClass('loading');
		this.getParentContainer().removeClass('empty');
		this.setNeedsUpdate(false);
        $.ajax({
            type: "GET",
            url: URL.getSolutionSpace,
            success: (data)=>{
                var structure = JSON.parse(data);
                this.buildSolutionSpacePanel(structure);
            }
        });
        return this;
    }

    /*
    Highlight a particular idea
    */
    highlightIdeaHandler(e){
		var tags = e.params.tags;
		// Add hover class
		var classes = '';
		for (var i = 0; i < tags.length; i++) {
			// Highlight header
			$(this.container + ' .' + ENV.classPrefix + tags[i] + '.headerCell').addClass('cellHover');
			for (var j = i; j < tags.length; j++) {
				if(tags[i] !== tags[j]){
					classes = ' .' + ENV.classPrefix + tags[i] + '.' + ENV.classPrefix + tags[j];
				} else {
					classes = ' .single.' + ENV.classPrefix + tags[i];
				}
				$(this.container + classes).addClass('cellHover');
			}	
		}
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
		var tags = e.params.tags;
		// Add class prefix
		for (var i = 0; i < tags.length; i++) {
			tags[i] = '.' + ENV.classPrefix + tags[i];
			$(this.container + ' ' + tags[i]).removeClass('cellHover');
		}
    }

    /*
    Build solution space panel
    */
    buildSolutionSpacePanel(structure){
		var maxN = structure.max_n;
        var container = $(this.container);
		
		if(structure.tags.length > 0){
			container.html(Mustache.render(TEMPLATES.solutionSpaceStructureTemplate));
			var innerContainer = $('#spaceContainer', container);
			// Make sure header columns and minimap stay in place
			container.on('scroll resize',(event)=>{
				$('#solutionSpaceHeader').offset({top:container.offset().top});
				$('#solutionSpaceLeftColumn').offset({left:container.offset().left});
				// var rightColumn = $('#solutionSpaceRightColumn');
				// rightColumn.offset({left:container.prop("clientWidth") - rightColumn.width()});
				// Minimap
				this.updatePan();
			});

			for(var i = 0; i < structure.tags.length; i++){
				var d = structure.tags[i];
				var cell = $('<div></div>').addClass('spCell');
				var stats = $('<div></div>').addClass('spCell');
				cell.append($('<span></span>').text(d.tag));
				cell.addClass(ENV.classPrefix + d.tag);
				cell.addClass('headerCell');
				$('#solutionSpaceHeader').append(cell);
				$('#solutionSpaceLeftColumn').append(cell.clone());
				// $('#solutionSpaceRightColumn').append(stats);
	
				// Create cells 
				// var newRow = $('<div></div>').addClass('spRow');
				// innerContainer.append(newRow);
				for(var j = i; j < structure.tags.length; j++){
					var e = structure.tags[j];
					var tags = [d.tag, e.tag].sort(); // Make it alphabetical
					var cellClass = 'spCell cl_' + (tags[0] === tags[1] ? tags [0] + ' single' : tags[0] + ' cl_' + tags[1]); // If this is the diagonal, add only one class.
					var newCell = $('<div><span></span></div>').addClass(cellClass);
					// paint cell
					var key = (d.tag === e.tag ? d.tag : tags.join('|'));
					var connection = structure.connections[key];
					if(connection){
						var tags = connection.tags.sort();
						var selector = 'spCell';
						tags.forEach(function(e,j){
							selector += ' cl_' + e;
						});
						$('span', newCell).css('background', 'rgba(102,102,102,' + (0.1 + (connection.n / maxN * 0.9)) + ')');
						// Add cell, clone, and add the new one
						newCell.css('left', i * 40 + 'px');
						newCell.css('top', j * 40 + 'px');
						if(d.tag !== e.tag){ // Don't add clone if it's the diagonal
							var newCellClone = newCell.clone();
							newCellClone.css('left', j * 40 + 'px');
							newCellClone.css('top', i * 40 + 'px');
						}
						// add to container
						$('#spaceContainer').append(newCell).append(newCellClone);
					}
				}
			}
	
			// Add interactivity
			$('.spCell', innerContainer).hover(function(e){
				// Add row and column highlight
				$(this).addClass('cellHover');
				var position = $(this).index() + 1;
				$('.spRow .spCell:nth-child('+position+')').addClass('cellHover');
				// Trigger highlight classes event
				var tags = UTIL.getClasses($(this), 'cl_');
				$.event.trigger({type:'highlightTags', params:{tags:tags}});
			},function(){
				// Remove row and column highlight
				$(this).removeClass('cellHover');
				var position = $(this).index() + 1;
				$('.spRow .spCell:nth-child('+position+')').removeClass('cellHover');
				// Remove ideahover class
				$.event.trigger({type:'blurTags', params:{}});
			}).click(function(event){
				event.stopPropagation();
				var classes = UTIL.getClasses($(this), 'cl_');
				// Clean up
				classes.forEach(function(d,i){
					classes[i] = d.replace('.cl_', '');
				});
				openOverlay('tagsView', {tags: classes});
			});
	
			// Setup minimap
			this.setupMiniMap(structure.overview);

		} else {
			// There are no tags
			this.getParentContainer().addClass('empty');
		}

		// Remove loading status
		this.getParentContainer().removeClass('loading');
    }

	setupMiniMap(image){
		var miniMap = $('#miniMap');
		var pan = $('#miniMap > #pan');
		pan.draggable({
			containment: 'parent',
			scope: 'miniMap',
			start: function(e){
				$(this).addClass('ondrag');
			},
			drag: function(e) {
				var pan = $(this);
				var offset = pan.position();
				var offsetRatio = {
					left: offset.left / miniMap.innerWidth(),
					top: offset.top / miniMap.innerHeight()
				};
				var scrollContainer = $('#solutionSpaceContainer');
				var scrollContainerWidth = $('#solutionSpaceHeader').innerWidth();
				var scrollContainerHeight = $('#solutionSpaceLeftColumn').innerHeight() + $('#solutionSpaceHeader').innerHeight();
				scrollContainer.scrollTop(offsetRatio.top * scrollContainerHeight);
				scrollContainer.scrollLeft(offsetRatio.left * scrollContainerWidth);
			},
			stop: function(e){
				$(this).removeClass('ondrag');
			}
		});
		miniMap.css('background', 'url(data:image/png;base64,' + image + ')');
		this.updatePan();
		// Make sure button matches this state
		$('#toggleMinimap').stop().addClass('active');
		// Show
		miniMap.fadeIn('fast');
	}

	updatePan(){
		var miniMap = $('#miniMap');
		var pan = $('#miniMap > #pan');
		if(!pan.hasClass('ondrag')){ // Make sure object is not being dragged
			// Set pan size based on total width and visible width
			var scrollPosition = {
				left: $('#solutionSpaceContainer').scrollLeft(),
				top: $('#solutionSpaceContainer').scrollTop()
			};
			var visibleDim = {
				width: $('#solutionSpaceContainer').innerWidth(),
				height: $('#solutionSpaceContainer').innerHeight()
			};
			var totalDim = {
				width: $('#solutionSpaceHeader').innerWidth(),
				height: $('#solutionSpaceLeftColumn').innerHeight() + $('#solutionSpaceHeader').innerHeight()
			};
			// Set size
			var panWidth = Math.ceil((visibleDim.width / parseFloat(totalDim.width)) * miniMap.innerWidth());
			var panHeight = Math.ceil((visibleDim.height / parseFloat(totalDim.height)) * miniMap.innerHeight());
			pan.css('width', (panWidth - 2) + 'px'); // - 2 to accoutn for some excess
			pan.css('height', (panHeight - 2) + 'px');
			// Set position
			pan.css('left', Math.ceil((scrollPosition.left * miniMap.innerWidth()) /  totalDim.width) + 'px');
			pan.css('top', Math.ceil((scrollPosition.top * miniMap.innerHeight()) /  totalDim.height)  + 'px'); 
		}
	}

	toggleMinimap(button){
		// Only execute if not loading
		if(!this.getParentContainer().hasClass('loading')){
			$('#miniMap').stop().fadeToggle('fast');
			button.stop().toggleClass('active');
		}
	}

};
