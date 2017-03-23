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

		structure.tags.forEach(function(d,i){
			var cell = $('<div></div>').addClass('spCell');
			var stats = $('<div></div>').addClass('spCell');
			cell.append($('<span></span>').text(d.tag));
			$('#solutionSpaceHeader').append(cell);
			$('#solutionSpaceLeftColumn').append(cell.clone());
			$('#solutionSpaceRightColumn').append(stats);

			// Create cells 
			var newRow = $('<div></div>').addClass('spRow');
			innerContainer.append(newRow);
			structure.tags.forEach(function(e,j){
				var tags = [d.tag, e.tag].sort(); // Make it alphabetical
				var cellClass = 'spCell cl_' + (tags[0] === tags[1] ? tags [0] : tags[0] + ' cl_' + tags[1]); // If this is the diagonal, add only one class.
				var newCell = $('<div><span></span></div>').addClass(cellClass);
				newRow.append(newCell);
			});
		});

		// Iterate over connections and paint them. TODO possibly optimize by using the previous double loop to already print the cell color
		// ALternatively, kill inner loop above and only print cells that have content
		var maxN = structure.max_n;
		structure.connections.forEach(function(d,i){
			var selector = 'spCell';
			var tags = d.tags.sort();
			tags.forEach(function(e,j){
				selector += ' cl_' + e;
			});
			$('[class="' + selector + '"] span').css('background', 'rgba(102,102,102,' + (0.1 + (d.n / maxN * 0.9)) + ')');
		});

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
