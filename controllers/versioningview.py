import json

'''
Controller for handling the back end of the versioning view
'''

def get_versioning_structure():
    ''' 
    Return the tree structure for the versioning panel 
    Structure:
    [
        {
            id:31,
            type: 'combination',
            tags: ['tag1', 'tag2'], 
            children: [
                {
                    id: 01,
                    ...,
                    children: ...
                },
                {
                    id: 91,
                    ...,
                    children: ...
                }
            ]
        }
    ]
    '''
    problem_id = session.problem_id
    # get all ideas
    query = (db.idea.id == db.tag_idea.idea) & (db.tag.id == db.tag_idea.tag) & (db.idea.problem == problem_id)
    results = db(query).select(orderby=db.idea.id, groupby=db.idea.id)
    # build idea map
    complete_idea_map = dict()
    filtered_idea_list = []
    for r in results:
        tags = [t.tag.tag for t in r.idea.tag_idea.select()]
        complete_idea_map[r.idea.id] = dict(
            tags=tags,
            type=r.idea.origin,
            id=r.idea.id
        )
        children = []
        if r.idea.sources:
            children = [complete_idea_map[c] for c in r.idea.sources]
        complete_idea_map[r.idea.id]['children'] = children
        if not r.idea.replacedBy:
            filtered_idea_list.append(complete_idea_map[r.idea.id])
    # return
    response.headers['Content-Type'] = 'application/json'
    return json.dumps(filtered_idea_list)