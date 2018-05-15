import json
import user_models

'''
Controller for handling the back end of the versioning view
'''

class ClassEncoder(json.JSONEncoder):
    def default(self, o):
        return o.__dict__

class Node(object):
    def __init__(self, tags, type, id, i, rank, children=[]):
        self.tags = tags
        self.type = type
        self.id = id
        self.i = i
        self.children = children
        self.rank = rank

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
    user_id = session.user_id
    # get all ideas
    query = (db.idea.id == db.tag_idea.idea) & (db.tag.id == db.tag_idea.tag) & (db.idea.problem == problem_id)
    results = db(query).select(orderby=db.idea.dateAdded, groupby=db.idea.id) # Ordered from older to newer
    # Get user model and ordered tag sequence
    model = user_models.UserModel(user_id, problem_id)
    ordered_tags = model.get_ordered_tags()
    # build idea map
    complete_idea_map = dict()
    filtered_idea_list = []
    ids = []
    for i,r in enumerate(results):
        tags = [t.tag.tag for t in r.idea.tag_idea.select()]
        complete_idea_map[r.idea.id] = Node(
            tags=tags,
            type=r.idea.origin,
            id=r.idea.id,
            i=i,
            rank=min([ordered_tags.index(t) for t in tags]) # Used for sorting
        )
        children = []
        if r.idea.sources:
            children = [complete_idea_map[c] for c in r.idea.sources]
        complete_idea_map[r.idea.id].children = children
        if not r.idea.replacedBy:
            filtered_idea_list.append(complete_idea_map[r.idea.id])
            ids.append(r.idea.id)
    # sort ideas according to user model
    filtered_idea_list.sort(key=lambda idea: (idea.rank, -idea.i))
    # Trim nodes to avoid redundancy
    for i in filtered_idea_list:
        __trim_node(i, ids)
    # return
    response.headers['Content-Type'] = 'application/json'
    return json.dumps(filtered_idea_list, cls=ClassEncoder)

def __trim_node(node, ids):
    ''' 
    This function walks the tree and trims the children of a node's child that is in the list of ids
    '''
    for i,c in enumerate(node.children):
        if c.id in ids:
            # If this node is also in ids, trim its children
            node.children[i] = Node(
                tags=c.tags,
                type=c.type,
                id=c.id,
                i=c.i,
                rank=c.rank,
                children=[]
            )
        else:
            # if it's not, recursively trim this node
            __trim_node(c, ids)
            
