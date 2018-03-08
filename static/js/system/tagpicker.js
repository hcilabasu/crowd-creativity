var setupTagPicker = function(container){
    var tagPicker = $(container);
    tagPicker.html(Mustache.render(TEMPLATES.tagPickerTemplate));
	var tags = $('.tags', tagPicker);
	// Setup switcher
	$('.alternative', tagPicker).click(function(){
		switchPanel(tagPicker);
	});

	// Setup filter
	$('.search', tagPicker).on('keyup paste', function(e){
		var text = $(this).val().toLowerCase();
		console.dir(text);
		var show = $('li[class*="t_' + text + '"]', tags);
		var hide = $('li:not([class*="' + text + '"])', tags);
		hide.hide();
		show.show();
	});

	// Setup remove tag
	$('.tagPlaceholder .close').click(function(e){
		var pressedButton = $(this);
		var placeholder = pressedButton.closest('.tagPlaceholder');
		// Check if this is placeholder1
		var isPlaceholder1 = placeholder.is('.tagPlaceholder:first');
		if(isPlaceholder1){
			// Check if placeholder 2 is used
			var placeholder2 = $('.tagPlaceholder:eq(1)', tagPicker);
			var isPlaceholder2Empty = placeholder2.hasClass('empty');
			if (isPlaceholder2Empty) {
				// Ph2 is not being used. It's ok to empty Ph1
				removeTag(placeholder);
			} else {
				// Placeholder 1 is being deleted and 2 is used. Move ph2 to ph1 and delete ph2
				var text = $('.text', placeholder2).text();
				removeTag(placeholder2);
				removeTag(placeholder);
				setTag(placeholder, text);
			}
		} else {
			// Ph2 being deleted needs no checks
			removeTag(placeholder);
		}
    });
    
    // load tags
    loadTags(tagPicker);
};

var loadTags = function(tagsContainer){
    var tagPicker = $('ul', tagsContainer);
    // Load available tags
	$.ajax({
		type: 'GET',
		url: URL.getAllTags,
		success: function(data){
			// Load tags
			tagPicker.removeClass('loading');
			tagPicker.empty();
			data.forEach(function(d,i){
				let li = $('<li></li>').addClass('t_' + d).text(d);
				tagPicker.append(li);
			});
			// Setup click on tag
			$('li',tagPicker).click(function(){
				var tag = $(this).text();
				var placeholder = $('.tagPlaceholder.empty:first', tagsContainer);
				if(placeholder.length > 0){
					// Check if a placeholder already holds this tag
					var placeholders = $('.tagPlaceholder', tagsContainer);
					for (let i = 0; i < placeholders.length; i++) {
						const ph = placeholders[i];
						if($('.text', ph).text() === tag){
							return false;
						}
					}
					setTag(placeholder, tag);
				}
			});
			// Enable filter
			$('.search', tagsContainer).prop('disabled', false);
		}
	});
}

/*
	If toTagPicker == true, this will switch to (or remain on) the tagPicker.
	If undefined, it will just flip
*/
var switchPanel = function(tagPicker, toTagPicker){
	var customTagInput = $('input[name=customTag]', tagPicker);
	var isAtCustomTag = customTagInput.val() === 'true';
	var changeNeeded = true;
	if(toTagPicker !== undefined){
		changeNeeded = toTagPicker && isAtCustomTag;
	}
	if(changeNeeded){
		$('.panel', tagPicker).toggle('slow');
		customTagInput.val(!isAtCustomTag);
	}
};

var teardownTagPicker = function(tagPicker, reloadList){
	var tagsContainer = $('.tags', tagPicker);
	// Refresh tagPicker
	if(reloadList){
		$('.search', tagPicker).prop('disabled', true);
		tagsContainer.empty()
		tagsContainer.html('<li><div class="loadingBadge"></div></li>');
		tagsContainer.addClass('loading');
	}
	// Empty tag placeholders
	var placeholders = $('.tagPlaceholder', tagPicker);
	placeholders.each(function(i,d){
		removeTag($(d));
	});
	// Empty suggest tags
	$('.suggestTags [name=suggestTags]').val('');
	// Revert back to tagPicker
	switchPanel(tagPicker, true);
};

var setTag = function(placeholder, tag){
	$('.text', placeholder).text(tag);
	placeholder.removeClass('empty');
	// Add tag to hidden input
	var input = $('input[name=pickTags]');
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

var removeTag = function(placeholder){
	var text = $('.text', placeholder);
	var currentTag = text.text();
	text.text('');
	placeholder.addClass('empty');
	// Remove tag from hidden input
	var input = $('input[name=pickTags]');
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

/*
	Params:
	* tagPickerRoot: selector string
		- selector for base of tag picker (same as was used to create the tag picker)
	* displayErrorMessage: function
		- function used to display the error message
	* hideErrorMessage: function
		- opposite of the displayErrorMessage param
	

	Returns:
	{
		valid: boolean,
		tags: []
	}
*/
var validateTagPicker = function(params){
	var tagPicker = $(params.tagPickerRoot);
	// Clean any tags errors
	params.hideErrorMessage(tagPicker);
	// Get values
	var pickTags = function(value){
		if (value === ''){
			return [];
		} else {
			return value.split(ENV.tagsDelimiter);
		}
	}($('[name=pickTags]', tagPicker).val());

	var suggestTags = function(value){
		if(value.trim() === ''){ 
			return undefined;
		}
		return value;
	}($('[name=suggestTags]', tagPicker).val());
	
	var customTag = function(value){
		return value === 'true';
	}($('[name=customTag]', tagPicker).val());
	
	// Validate
	var tags = customTag ? suggestTags : pickTags;
	if (tags === undefined){
		tags = [];
	} else if (!(tags.constructor === Array)){
		tags = [tags];
	}
	var valid = true;
	if(tags.length < 1){
		params.displayErrorMessage(tagPicker);
		valid = false;
	}
	// Return values
	return {
		valid: valid,
		tags: tags
	};
};