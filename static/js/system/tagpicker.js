/*
This plugin is pretty coupled to this system.
External dependencies:
- URL.getAllTags (the URL to be used for loading the tags)
- TEMPLATES.tagPickerTemplate (HTML template to be used for the picker)
- ENV.tagsDelimiter
- Mustache library (to load the template)
*/

$.fn.tagPicker = function(action, params){

	var topContainer = this; // This is the container on which the plugin was called on

	/*
	Fetches the tags through AJAX and adds them to the tagslist
	*/
	var loadTags = function(tagsList, topContainer){
		// Load available tags
		$.ajax({
			type: 'GET',
			url: URL.getAllTags,
			success: function(data){
				// Load tags
				$('.loading', topContainer).removeClass('loading');
				tagsList.empty();
				if (data.length == 0){
					// Add li saying that no tags exist
					var noTagsLi = $('<li>No tags have been added yet. Add your own.</li>');
					noTagsLi.css('text-transform','none');
					noTagsLi.click(function(){switchPanel(topContainer);});
					tagsList.append(noTagsLi);
				} else {
					data.forEach(function(d,i){
						let li = $('<li></li>').addClass('t_' + d).text(d);
						tagsList.append(li);
					});
					// Add "create new" item
					tagsList.append($('<li></li>').addClass('createNew'));
					// Add tag on click
					$('li',tagsList).click(function(){
						var tag = $(this).text();
						var index = addTag(tag, topContainer);
						if(index >= 0){
							callAttention($('.tagPlaceholder').eq(index), 200, 'new');
						}
					});
					// Enable filter
					$('.search', topContainer).prop('disabled', false);
				}
			}
		});
	}

	/*
		If instant == true, there will be no animation
	*/
	var switchPanel = function(topContainer, instant){
		var speed = instant ? 0 : 'slow';
		$('.panel', topContainer).toggle(speed);
		// Switch alternative button text
		$('.alternative > span', topContainer).toggle();
	};

	/*
	Calls attention to a tag placeholder by doing something like shaking it
	*/
	var callAttention = function(placeholder, delay, attnClass){
		delay = delay ? delay : 1000;
		attnClass = attnClass ? attnClass : 'shake';
		placeholder.addClass(attnClass).delay(delay).queue(function(){
			$(this).removeClass(attnClass).dequeue();
		});
	};

	/*
	Adds a tag to the hidden tags input. Returns the index of the tag that was added, or -1 if no tag was added
	*/
	var addTag = function(tag, topContainer){
		// Get tags
		var input = $('[name=tags]', topContainer);
		var placeholders = $('.tagPlaceholder', topContainer);
		var tags = input.val() === '' ? [] : input.val().split(ENV.tagsDelimiter);
		var returnIndex = -1;
		if(tags.indexOf(tag) < 0){
			if (tags.length < 2) {
				// Tag hasn't been added yet, there is room, and tag is not empty
				returnIndex = tags.length;
				tags.push(tag);
				// trim empty tags
				while(tags.indexOf('') >= 0){
					var i = tags.indexOf('');
					tags.splice(i, 1); 
				}
				// Update input and add delimiter
				input.val(tags.join(ENV.tagsDelimiter)).change();
			} else {
				// There are already two tags. Display message
				callAttention($('.maxTagWarning'), 5000);
			}
		} else {
			// Tag already exists. Shake it!
			var tagIndex = tags.indexOf(tag);
			callAttention(placeholders.eq(tagIndex));
		}
		// Animate the container down to show placeholder
		var scrollParent = placeholders.scrollParent();
		scrollParent.animate({
			scrollTop: placeholders.offset().top
		}, 200);
		return returnIndex;
	}

	/*
	Removes a tag by its index from the hidden tags input 
	*/
	var removeTag = function(tagN, topContainer){
		// Get tags
		var input = $('[name=tags]', topContainer);
		var tags = input.val().split(ENV.tagsDelimiter);
		if(tagN < tags.length){
			// There are enough elements to remove the desired index
			tags.splice(tagN, 1);
			input.val(tags.join(ENV.tagsDelimiter)).change();
		}
	}

	/*
	This function responds to a change in the tags hidden input.
	It reflects that change in both the placeholders and the text inputs.
	*/
	var tagChange = function(e, topContainer){
		var input = $(e.target);
		var tags = input.val() === '' ? [] : input.val().split(ENV.tagsDelimiter);
		var placeholders = $('.tagPlaceholder', topContainer);
		// Calculate the difference in tag len
		var deltaTagsPlaceholders = placeholders.length - tags.length;
		// Update tags
		var i;
		for (i = 0; i < tags.length; i++) {
			const tag = tags[i];
			var placeholder = $('.tagPlaceholder[data-i='+i+']');
			var tagInput = $('.suggestTags input[data-i='+i+']');
			// Add tag to placeholder	
			$('.text', placeholder).text(tag);
			placeholder.removeClass('empty');
			// Add tag to input
			tagInput.val(tag).change();
		}
		// Clear the remaining ones
		for (let j = i; j < i + deltaTagsPlaceholders; j++) {
			// Clear placeholder
			var placeholder = $('.tagPlaceholder[data-i='+j+']');
			placeholder.addClass('empty');
			// Clear input
			var tagInput = $('.suggestTags input[data-i='+j+']');
			tagInput.val('').change();
		}
		// Make sure that second input is enabled if there is one tag
		var secondInput = $('.suggestTags input[data-i=1]');
		if(tags.length > 0){
			secondInput.attr('disabled', false);
		} else {
			secondInput.attr('disabled', true);
		}
	}

	if(action === 'setup'){
		topContainer.html(Mustache.render(TEMPLATES.tagPickerTemplate));
		var tagsList = $('.tagsList', topContainer); // The ul element that holds the tags

		// Setup switcher
		$('.alternative', topContainer).click(function(){
			switchPanel();
		});
	
		// Prevent special characters on inputs
		// From: https://stackoverflow.com/questions/2980038/allow-text-box-only-for-letters-using-jquery
		$('input[type=text]', topContainer).bind('keyup blur input',function(){ 
			var node = $(this);
			node.val(node.val().replace(/[^a-z]/g,'') ); }
		);
	
		// Setup filter
		$('.search', topContainer).on('keyup paste', function(e){
			var text = $(this).val().toLowerCase();
			var show = $('li[class*="t_' + text + '"]', tagsList);
			var hide = $('li:not([class*="' + text + '"])', tagsList);
			hide.hide();
			show.show();
			// Toggle create new option if there are no results
			var createNew = $('.createNew', tagsList);
			if(show.length === 0){
				createNew.text(text);
				createNew.show();
			} else {
				createNew.hide();
			};
		});
	
		// Setup remove tag when the x on the tag placeholder is clicked
		$('.tagPlaceholder .close', topContainer).click(function(e){
			var pressedButton = $(this);
			var placeholder = pressedButton.closest('.tagPlaceholder');
			var placeholderIndex = parseInt(placeholder.data('i'));
			// Remove tag
			removeTag(placeholderIndex, topContainer);
		});

		loadTags(tagsList, topContainer);

		// Attach change event to tags input
		$('[name=tags]', topContainer).change(function(e){
			tagChange(e, topContainer);
		});

		// Attach event handler to text tag input
		$('.suggestTags input[type=text]', topContainer).on('keyup blur input', function(e){
			var input = $(e.target);
			var inputIndex = parseInt(input.data('i'));
			var hiddenInput = $('[name=tags]', topContainer);
			// Update values in hidden input
			// 1. clear input
			hiddenInput.val('');
			// 2. add values
			var tags = []
			$('.suggestTags input[type=text]', topContainer).each(function(i,d){
				var tagInput = $(d);
				if (!tagInput.is(':disabled')){
					tags.push(tagInput.val());
				}
			});
			for (let i = 0; i < tags.length; i++) {
				const tag = tags[i];
				addTag(tag, topContainer);
			}

		});
	
	} else if (action === 'validate'){
		/*
		TAG validation action
		*/
		// var tagPicker = $(params.tagPickerRoot);
		var settings = $.extend({
			hideErrorMessage: function(){},
			displayErrorMessage: function(){}
		}, params);
		// Clean any tags errors
		settings.hideErrorMessage(topContainer);
		// Get values
		var tags = function(value){
			if (value === ''){
				return [];
			} else {
				return value.split(ENV.tagsDelimiter);
			}
		}($('[name=tags]', topContainer).val());
		
		// Validate
		if (tags === undefined){
			tags = [];
		} else if (!(tags.constructor === Array)){
			tags = [tags];
		}
		var valid = true;
		if(tags.length < 1){
			settings.displayErrorMessage(topContainer);
			valid = false;
		}
		// Return values
		return {
			valid: valid,
			tags: tags
		};

		

	} else if (action === 'teardown'){
		/*
		Teardown the tag picker action
		*/
		var settings = $.extend({
			reloadList: true
		}, params);

		var tagsList = $('.tagsList', topContainer);
		// Refresh tagPicker
		if(settings['reloadList']){
			loadTags(tagsList, topContainer);
		}
		// Empty tag placeholders
		var placeholders = $('.tagPlaceholder', topContainer);
		placeholders.each(function(i,d){
			removeTag(i, topContainer);
		});
		// Empty suggest tags
		$('.suggestTags [name=suggestTags]', topContainer).val('');
		// Revert back to tagPicker
		switchPanel(topContainer, true);
	}

	return this;
};
