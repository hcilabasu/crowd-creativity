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
					// Setup click on tag
					$('li',tagsList).click(function(){
						var tag = $(this).text();
						var placeholder = $('.tagPlaceholder.empty:first', topContainer);
						if(placeholder.length > 0){
							// Check if a placeholder already holds this tag
							var placeholders = $('.tagPlaceholder', topContainer);
							for (let i = 0; i < placeholders.length; i++) {
								const ph = placeholders[i];
								if($('.text', ph).text() === tag){
									return false;
								}
							}
							setTag(placeholder, tag, topContainer);
						}
					});
					// Enable filter
					$('.search', topContainer).prop('disabled', false);
				}
			}
		});
	}

	/*
		If toTagPicker == true, this will switch to (or remain on) the tagPicker.
			If undefined, it will just flip
		If instant == true, there will be no animation
	*/
	var switchPanel = function(topContainer, toTagPicker, instant){
		var customTagInput = $('input[name=customTag]', topContainer);
		var isAtCustomTag = customTagInput.val() === 'true';
		var changeNeeded = true;
		if(toTagPicker !== undefined){
			changeNeeded = toTagPicker && isAtCustomTag;
		}
		if(changeNeeded){
			var speed = instant ? 0 : 'slow';
			$('.panel', topContainer).toggle(speed);
			customTagInput.val(!isAtCustomTag);
		}
	};

	/*
	Clears a tag from the placeholder (i.e. it goes back to being an empty placeholder) 
	*/
	var removeTag = function(placeholder, topContainer){
		var text = $('.text', placeholder);
		var currentTag = text.text();
		text.text('');
		placeholder.addClass('empty');
		// Remove tag from hidden input
		var input = $('input[name=pickTags]', topContainer);
		var current = input.val();
		var tags = current.split(ENV.tagsDelimiter);
		var newVal = '';
		if(tags.length > 1){
			var removeIndex = tags.indexOf(currentTag);
			tags.splice(removeIndex, 1);
			newVal = tags[0];
		}
		input.val(newVal);
	}

	var setTag = function(placeholder, tag, topContainer){
		// trim tag
		tag = tag.replace(/\s/g,'');
		$('.text', placeholder).text(tag);
		placeholder.removeClass('empty');
		// Add tag to hidden input
		var input = $('input[name=pickTags]', topContainer);
		var current = input.val();
		var tags = current.split(ENV.tagsDelimiter);
		if(tags.indexOf(tag) < 0){ // Tag may already be in there
			if(tags.length===1 && tags[0]===''){
				// input is empty
				input.val(tag);
			} else {
				input.val(current + ENV.tagsDelimiter + tag);
			}
		}
	};

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
			// Check if this is placeholder1
			var isPlaceholder1 = placeholder.is('.tagPlaceholder:first');
			if(isPlaceholder1){
				// Check if placeholder 2 is used
				var placeholder2 = $('.tagPlaceholder:eq(1)', topContainer);
				var isPlaceholder2Empty = placeholder2.hasClass('empty');
				if (isPlaceholder2Empty) {
					// Ph2 is not being used. It's ok to empty Ph1
					removeTag(placeholder, topContainer);
				} else {
					// Placeholder 1 is being deleted and 2 is used. Move ph2 to ph1 and delete ph2
					var text = $('.text', placeholder2).text();
					removeTag(placeholder2, topContainer);
					removeTag(placeholder, topContainer);
					setTag(placeholder, text, topContainer);
				}
			} else {
				// Ph2 being deleted needs no checks
				removeTag(placeholder, topContainer);
			}
		});

		loadTags(tagsList, topContainer);


	
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
		var pickTags = function(value){
			if (value === ''){
				return [];
			} else {
				return value.split(ENV.tagsDelimiter);
			}
		}($('[name=pickTags]', topContainer).val());
	
		var suggestTags = function(inputs){
			var tags = []
			$.each(inputs, function(i,d){
				var input = $(d);
				if(input.val().trim() !== ''){ 
					tags.push(input.val().replace(/\s/g,''));
				}
			});
			return tags;
		}($('[name=suggestTags]', topContainer));
		
		var customTag = function(value){
			return value === 'true';
		}($('[name=customTag]', topContainer).val());
		
		// Validate
		var tags = customTag ? suggestTags : pickTags;
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
			removeTag($(d));
		});
		// Empty suggest tags
		$('.suggestTags [name=suggestTags]', topContainer).val('');
		// Revert back to tagPicker
		switchPanel(topContainer, true);
	}

	return this;
};
