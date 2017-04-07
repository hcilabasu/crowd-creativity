# Crowd Creativity

This is a web2py project. Just download web2py, add this to the applications folder, and you should be good to go!

## Todo for Study 1
- Implement tag suggestions when adding / combining ideas. Possibly remove suggest tasks, simply using user input + automated keyword extraction
- Validate input
- Allow enter to submit the idea if the category input is highlighted
- Implement categorization tasks
- Implement iteration of idea
- Implement click action on idea in the task panel

## Wishlist
- Implement persistance of layout
- Consolidate prefixes (e.g. cl_, id) into constants (possibly at the ENV variable)
- Move each mustache template to its own html file
- Possibly hide the ideas in the task view until hover action is triggered
- Turn the idea viewer into a generic view. Multiple instances can be opened, allowing for advanced search queries. The solution space would open one such window when a category is clicked.

## Known issues
- The bottom of the layout is cutoff by the amount of the navbar
- It is possible that two ideas in the versioning panel may be placed in the same location. Implement collision detection and handling.

## Completed
- Color-code user ideas vs other ideas (implemented as a text at the bottom of the idea block)
- Improve versioning visualization by minimizing edge length (children are always placed in between parents)
- Refactored code to use custom events to trigger highlights in each panel
- Standardize tags, concepts, categories to tags only.
- Implement real time updating (NOTE: not real time yet. Implemented auto reload for now. Real time will require more thought)
- When something is highlighted in a panel, scroll panel to focus on it (implemented with a timer)