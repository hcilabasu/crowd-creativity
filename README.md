# Crowd Creativity

This is a web2py project. Just download web2py, add this to the applications folder, and you should be good to go!

## Todo for Study 1
- Fix display of a really long idea by possibly cloning element, expanding it significantly, and adding a scrollbar
- Highlight headers on solution space when a cell is highlighted
- Implement tag suggestions based on existing tag + similarity to previous ideas
- Light tracking of UI actions (what's clicked, when, where user is focusing, etc.)
- Minimap: implement click to go to; sync with scrollbar scroll; deal with cropping issue.

## Known issues
...

## Future
- Deal with scalability issues (in all three views. Possibly do dynamic loading, e.g. infinite scrolling)
- Implement persistance of layout
- Consolidate prefixes (e.g. cl_, id) into constants (possibly at the ENV variable)
- Move each mustache template to its own html file
- Possibly hide the idea text in the task view until hover action is triggered
- Turn the idea viewer into a generic view. Multiple instances can be opened, allowing for advanced search queries. The solution space would open one such window when a category is clicked.
- Implement iteration of idea
- It is possible that two ideas in the versioning panel may be placed in the same location. Implement collision detection and handling.
- Implement click action on idea in the task panel

## Completed
- Resizing layout elements (e.g. by dragging the dividers) does not trigger a resize event
- The bottom of the layout is cutoff by the amount of the navbar
- Implement minimap for solution space
- Add loading symbols when loading views
- Implement source of events; prevent scroll on view that originates hover
- Implement categorization tasks
- Validate input
- Implement tag suggestions when adding / combining ideas. Possibly remove suggest tasks, simply using user input + automated keyword extraction
- Color-code user ideas vs other ideas (implemented as a text at the bottom of the idea block)
- Improve versioning visualization by minimizing edge length (children are always placed in between parents)
- Refactored code to use custom events to trigger highlights in each panel
- Standardize tags, concepts, categories to tags only.
- Implement real time updating (NOTE: not real time yet. Implemented auto reload for now. Real time will require more thought)
- When something is highlighted in a panel, scroll panel to focus on it (implemented with a timer)