import json
import util
import datetime
import user_models

'''
Controller for handling the back end of the versioning view
'''

class ClassEncoder(json.JSONEncoder):
    def default(self, o):
        return o.__dict__

class ClassDecoder(json.JSONDecoder):
    def __init__(self, *args, **kwargs):
        json.JSONDecoder.__init__(self, object_hook=self.object_hook, *args, **kwargs)

    def object_hook(self, obj):
        if 'i' not in obj:
            return obj
        return Node(
            obj['tags'],
            obj['type'],
            obj['id'],
            obj['i'],
            obj['children']
        )

class Node(object):
    def __init__(self, tags, type, id, i, children=[]):
        self.tags = tags
        self.type = type
        self.id = id
        self.i = i
        self.children = children

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
    problem_id = util.get_problem_id(request)
    user_id = session.user_id
    cache_type = 'versioning'
    timestamp = datetime.datetime.min
    complete_idea_map = dict()
    filtered_idea_list = []
    ids = []

    # Retrieve latest cache
    cache = db((db.visualization_cache.problem == problem_id) & (db.visualization_cache.type == cache_type)).select().first()
    if cache:
        json_cache = json.loads(cache.cache, cls=ClassDecoder)
        timestamp = cache.timestamp
        complete_idea_map = json_cache['complete_idea_map']
        filtered_idea_list = json_cache['filtered_idea_list']
        ids = json_cache['ids']

    # get all ideas
    query = (
        (db.idea.id == db.tag_idea.idea) & 
        (db.tag.id == db.tag_idea.tag) & 
        (db.idea.problem == problem_id) &
        (db.idea.dateAdded > timestamp))
    results = db(query).select(orderby=db.idea.dateAdded, groupby=db.idea.id) # Ordered from older to newer

    # Get user model and ordered tag sequence
    model = user_models.UserModel(user_id, problem_id)
    ordered_tags = model.get_ordered_tags()
    
    # build idea map
    for i,r in enumerate(results):
        tags = [t.tag.tag for t in r.idea.tag_idea.select()]
        complete_idea_map[str(r.idea.id)] = Node(
            tags=tags,
            type=r.idea.origin,
            id=r.idea.id,
            i=i)
        children = []
        if r.idea.sources:
            children = [complete_idea_map[str(c)] for c in r.idea.sources]
        complete_idea_map[str(r.idea.id)].children = children
        if not r.idea.replacedBy:
            filtered_idea_list.append(complete_idea_map[str(r.idea.id)])
            ids.append(r.idea.id)
    
    # Trim nodes to avoid redundancy
    for i in filtered_idea_list:
        __trim_node(i, ids)

    # Update cache
    key = (db.visualization_cache.problem == problem_id) & (db.visualization_cache.type == cache_type)
    db.visualization_cache.update_or_insert(key,
        problem=problem_id,
        type=cache_type,
        cache=json.dumps(dict(
            complete_idea_map=complete_idea_map,
            filtered_idea_list=filtered_idea_list,
            ids=ids
        ), cls=ClassEncoder),
        timestamp=datetime.datetime.now())

    # sort ideas according to user model
    filtered_idea_list.sort(key=lambda idea: (min([ordered_tags.index(t) for t in idea.tags]), idea.i))
    
    # Log
    log_action(user_id, problem_id, 'get_versioning_structure', {'cache': (cache != None)})

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
                children=[]
            )
        else:
            # if it's not, recursively trim this node
            __trim_node(c, ids)
            
