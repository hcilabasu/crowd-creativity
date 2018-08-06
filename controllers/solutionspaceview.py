import json
import itertools
import base64
import cStringIO
import user_models
import util
import datetime
import ast
from PIL import Image

'''
Controller for functions related to the solution space view
'''

SIZE_OVERLAP = 2 # size of permutation to be added for the solution space overview (e.g. when = 2, the structure keep track of the count of pairs of tags)
SOLUTION_SPACE_MAX_TAGS = 200
BIRDSEYE_SIZE = 100 # size of the solution space birdseye view

def get_solution_space():
    user_id = session.user_id
    problem_id = util.get_problem_id(request)
    user_model = user_models.UserModel(user_id, problem_id)
    cache_type = 'solutionspace'
    connections = dict()
    timestamp = datetime.datetime.min
    max_n = 0

    # Retrieve latest cache
    # TODO Cache is temporarily disabled since I change the handling of an idea's pool flag to run the studies. That means each user will have their own cache.
    cache = None #db((db.visualization_cache.problem == problem_id) & (db.visualization_cache.type == cache_type)).select().first()
    if cache:
        json_cache = json.loads(cache.cache)
        connections = json_cache['connections']
        timestamp = cache.timestamp
        max_n = json_cache['max_n']

    # Get tags ordered by the user model
    tags = user_model.get_ordered_tags()

    # get ideas with respective tags
    ideas = db((db.idea.id == db.tag_idea.idea) & 
        (db.tag.id == db.tag_idea.tag) &
        (db.idea.dateAdded >= timestamp) &
        (db.idea.problem == problem_id) & 
        ((db.idea.pool == True) | (db.idea.userId == user_id))
    ).select(orderby=~db.idea.id, groupby=db.idea.id)
    
    # extract tags
    all_tags = []
    for idea in ideas:
        idea_tags = list()
        for tag in idea.idea.tag_idea.select():
            tag = tag.tag.tag.lower()
            idea_tags.append(tag)
            all_tags.append(tag)
        idea_tags.sort() # this contains a sorted array of tags for idea
        # insert into data structure
        key = '|'.join(idea_tags)
        if key not in connections.keys():
            connections[key] = dict(tags=idea_tags, n=0)
        n = connections[key]['n'] + 1
        connections[key]['n'] = n
        if n > max_n:
            max_n = n
    tags = tags[:SOLUTION_SPACE_MAX_TAGS]

    # since another user may have added another tag, and since "tags" holds ALL tags, we need to remove those that are not in "ideas"
    final_tags = []
    for t in tags:
        if t in all_tags:
            final_tags.append(t)

    # Create minimap overview and generate outcome dict
    overview = __generate_birdseye_solutionspace(final_tags, connections, max_n=max_n)
    outcome = json.dumps(dict(tags=final_tags, connections=connections, max_n=max_n, overview=overview))
    
    # Update cache
    # key = (db.visualization_cache.problem == problem_id) & (db.visualization_cache.type == cache_type)
    # db.visualization_cache.update_or_insert(key,
    #     problem=problem_id,
    #     type=cache_type,
    #     cache=outcome,
    #     timestamp=datetime.datetime.now())
    
    # Log
    log_action(user_id, problem_id, 'get_solution_space', {'cache': (cache != None)})
    
    return outcome

def get_ideas_per_tag():
    '''
    Retrieve all ideas that have the tags passed as parameter
    '''
    tag = request.vars['tag']
    if not tag: #no tag was passed as param. Return empty
        return json.dumps([])
    # There is a tag. Retrieve ideas
    ideas = db((db.idea.id == db.tag_idea.idea) & 
        (db.tag.id == db.tag_idea.tag) &
        (db.tag.tag == tag)
    ).select(orderby=~db.idea.id, groupby=db.idea.id)

    clean_ideas = [
        dict(id=i.idea.id,
            userId=i.idea.userId, 
            idea=i.idea.idea, 
            tags=[tag.tag.tag for tag in i.idea.tag_idea.select()]
        ) for i in ideas]
    return json.dumps(clean_ideas)


# PRIVATE FUNCTIONS

def __generate_birdseye_solutionspace(tags, connections, max_n):
    # Create image
    size = len(tags)
    img = Image.new('RGBA', (size,size), "white") # create a new black image
    pixels = img.load() # create the pixel map
    conn_keys = connections.keys()
    # Create shading. Basically mimicking the JS algorithm
    for i, ti in enumerate(tags):
        for j, tj in enumerate(tags):
            # Create key
            key = ti
            if ti != tj:
                key_list = [ti, tj]
                key_list.sort()
                key = '|'.join(key_list)
            # Get connection object
            if key in conn_keys:
                connection = connections[key]
                # $('span', newCell).css('background', 'rgba(102,102,102,' + (0.1 + (connection.n / maxN * 0.9)) + ')');
                level = 255 - int((0.1 + (connection['n'] / float(max_n)) * 0.9) * 255)
                color = (level,level,level)
                pixels[i,j] = color
                pixels[j,i] = color
    
    # Convert to correct size
    img = img.resize((BIRDSEYE_SIZE,BIRDSEYE_SIZE), Image.NEAREST)
    # Encode into base64
    buffer = cStringIO.StringIO()
    img.save(buffer, format="PNG")
    img_str = base64.b64encode(buffer.getvalue())
    return img_str