# Crowd Creativity

This is a web2py project. Just download web2py, add this to the applications folder, and you should be good to go!

## Todo for Study 1
- Validate input
- Allow enter to submit the idea if the category input is highlighted
- When hovering for over 1 second on an idea, category, or anywhere else applicable, update the suggested tasks panel with 5 suggested tasks based on the context of the highlighted idea. Make sure to do something to call attention to the panel (e.g. glow)
- Implement categorization tasks
- When something is highlighted in a panel, scroll panel to focus on it
- Implement iteration of idea 
- Implement real time updating

## Wishlist
- Implement persistance of layout
- Implement a central highlighting function and standard, that whenever called highlights ideas in any panels

## Known issues
- The bottom of the layout is cutoff by the amount of the navbar
- It is possible that two ideas in the versioning panel may be placed in the same location.
- Last categories in solution space view are clipped

## Completed
- Color-code user ideas vs other ideas (implemented as a text at the bottom of the idea block)
- Improve versioning visualization by minimizing edge length (children are always placed in between parents)
