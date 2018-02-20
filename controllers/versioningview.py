import json

'''
Controller for handling the back end of the versioning view
'''

def get_versioning_structure():
    ''' 
    Return the structure for the versioning panel 
    Structure:
    [
        [{ <-- Level 0 start
            id:31, connections: [{ids:[43,57], type:'merge'}, ...]
         }, 
         {
            id:..., connections: [...]
         }],     
        [ <-- Level 1 start
            ...
        ],     
        ...
    ]

    '''
    problem_id = session.problem_id
    # get all ideas
    results = db((db.idea.id == db.tag_idea.idea) & 
               (db.tag.id == db.tag_idea.tag) & 
               (db.idea.problem == problem_id)
    ).select(orderby=db.idea.id, groupby=db.idea.id)
    
    # start aux variables
    levels_map = dict() # key: idea_id, value: level
    levels = []
    # Iterate over each result and build the levels array
    for r in results:
        sources = r.idea.sources
        
        level = __get_level(r.idea.sources, levels_map)
        # add level to dictionary
        levels_map[r.idea.id] = level
        if level > len(levels)-1: # this is the first idea in a new level
            levels.append([])
        # add idea to level list
        levels[level].append(dict(
            id = r.idea.id,
            connection = dict(
                type= r.idea.origin,
                ids = r.idea.sources
            )
        ))
        # clean_ideas = [dict(id=i.idea.id, idea=i.idea.idea) for i in ideas]
    return json.dumps(levels)



# PRIVATE FUNCTIONS

def __get_level(ids, levels_map):
    # Gets the level of an idea based on its sources
    max_level = -1
    if ids:
        for id in ids:
            max_level = max(max_level, levels_map[id])
    return max_level+1