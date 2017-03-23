# Crowd Creativity

This is a web2py project. Just download web2py, add this to the applications folder, and you should be good to go!

## Todo for Study 1
- Validate input
- Allow enter to submit the idea if the category input is highlighted
- When hovering for over 1 second on an idea, category, or anywhere else applicable, update the suggested tasks panel with 5 suggested tasks based on the context of the highlighted idea. Make sure to do something to call attention to the panel (e.g. glow)
- Implement categorization tasks
- When something is highlighted in a panel, scroll panel to focus on it
- Implement iteration of idea 

## Wishlist
- Implement persistance of layout
- Consolidate prefixes (e.g. cl_, id) into constants (possibly at the ENV variable)

## Known issues
- The bottom of the layout is cutoff by the amount of the navbar
- It is possible that two ideas in the versioning panel may be placed in the same location.

## Completed
- Color-code user ideas vs other ideas (implemented as a text at the bottom of the idea block)
- Improve versioning visualization by minimizing edge length (children are always placed in between parents)
- Refactored code to use custom events to trigger highlights in each panel
- Standardize tags, concepts, categories to tags only.
- Implement real time updating (NOTE: not real time yet. Implemented auto reload for now. Real time will require more thought)