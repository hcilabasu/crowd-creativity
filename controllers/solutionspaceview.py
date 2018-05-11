import json
import itertools
import base64
import cStringIO
from PIL import Image

'''
Controller for functions related to the solution space view
'''

SIZE_OVERLAP = 2 # size of permutation to be added for the solution space overview (e.g. when = 2, the structure keep track of the count of pairs of tags)
SOLUTION_SPACE_MAX_TAGS = 200
BIRDSEYE_SIZE = 100 # size of the solution space birdseye view

def get_solution_space():
    problem_id = session.problem_id
    tags = db((db.tag.id > 0) & (db.tag.replacedBy == None) & (db.tag.problem == problem_id)).select().as_list()
    # get ideas with respective tags
    ideas = db((db.idea.id == db.tag_idea.idea) & 
        (db.tag.id == db.tag_idea.tag)
    ).select(orderby=~db.idea.id, groupby=db.idea.id)
    # extract tags
    i = 0
    max_n = 0
    connections = dict()
    for idea in ideas:
        idea_tags = list()
        for tag in idea.idea.tag_idea.select():
            tag = tag.tag.tag.lower()
            idea_tags.append(tag)
        idea_tags.sort() # this contains a sorted array of tags for idea
        # insert into data structure
        for i in range(1,SIZE_OVERLAP+1): # this will iterate over all unique permutations of the tags, inserting them in pairs
            for combination in itertools.combinations(idea_tags, i):
                key = '|'.join(combination)
                if key not in connections.keys():
                    connections[key] = dict(tags=combination, n=0)
                n = connections[key]['n'] + 1
                connections[key]['n'] = n
                if n > max_n:
                    max_n = n
    tags = tags[:SOLUTION_SPACE_MAX_TAGS]
    # Sort tags based on sorter
    
    base64_image = __generate_birdseye_solutionspace(tags, connections, max_n=max_n)
    return json.dumps(dict(tags=tags, connections=connections, max_n=max_n, overview=base64_image))

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
            key = ti['tag']
            if ti != tj:
                key_list = [ti['tag'], tj['tag']]
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