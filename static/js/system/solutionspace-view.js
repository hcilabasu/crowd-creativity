class SolutionSpaceView extends View {

    /*
    Empties the container and initializes the view inside of it
    */
    load(){
        console.dir('Initializing View');
        $(this.container).empty();
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
        console.dir('CUSTOM SOLUTIONSPACE Highlight idea');
    }

    /*
    Blur a particular idea
    */
    blurIdeaHandler(e){
        console.dir('CUSTOM SOLUTIONSPACE Blur idea');
    }

    /*
    Build solution space panel
    */
    buildSolutionSpacePanel(structure){
		var maxN = structure.max_n;
        var container = $(this.container);
        container.html(Mustache.render(TEMPLATES.solutionSpaceStructureTemplate));
        var innerContainer = $('#spaceContainer', container);
        // Make sure header columns stay in place
        container.on('scroll resize',function(event){
            $('#solutionSpaceHeader').offset({top:container.offset().top});
            $('#solutionSpaceLeftColumn').offset({left:container.offset().left});
            var rightColumn = $('#solutionSpaceRightColumn');
            rightColumn.offset({left:container.prop("clientWidth") - rightColumn.width()});
        });

		for(var i = 0; i < structure.tags.length; i++){
			var d = structure.tags[i];
			var cell = $('<div></div>').addClass('spCell');
			var stats = $('<div></div>').addClass('spCell');
			cell.append($('<span></span>').text(d.tag));
			$('#solutionSpaceHeader').append(cell);
			$('#solutionSpaceLeftColumn').append(cell.clone());
			$('#solutionSpaceRightColumn').append(stats);

			// Create cells 
			// var newRow = $('<div></div>').addClass('spRow');
			// innerContainer.append(newRow);
			for(var j = i; j < structure.tags.length; j++){
				var e = structure.tags[j];
				var tags = [d.tag, e.tag].sort(); // Make it alphabetical
				var cellClass = 'spCell cl_' + (tags[0] === tags[1] ? tags [0] : tags[0] + ' cl_' + tags[1]); // If this is the diagonal, add only one class.
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
					var newCellClone = newCell.clone();
					newCell.css('left', i * 40 + 'px');
					newCell.css('top', j * 40 + 'px');
					newCellClone.css('left', j * 40 + 'px');
					newCellClone.css('top', i * 40 + 'px');
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
    }

};
