import uuid
import datetime
import json
from collections import defaultdict
import itertools
from string import punctuation
import rake
import os
import random
import microtask

DEBUG = True # Add debug mode
NUKE_KEY = 'blastoise'
ADD_TO_POOL = True
TEST_USER_ID = None #'testuser1' # Use None if no test ID is needed
TASKS_PER_IDEA = 2 # For each idea that is added, add this number of tasks per kind of task per idea. This will depend on the number of users

def nuke(): # Nukes the database to blank.
    if (request.vars.key and request.vars.key == NUKE_KEY) and DEBUG:
        # nuke!
        db(db.tag.id > 0).delete()
        db(db.tag_idea.id > 0).delete()
        db(db.idea.id > 0).delete()
        db(db.categorization.id > 0).delete()
        db(db.user_info.id > 0).delete()
        db(db.idea_rating.id > 0).delete()
        db(db.action_log.id > 0).delete()
        return 'Nuke is a GO'
    else:
        response.status = 500
        return 'Nuke is a negative!'            

def logoff():
    session.user_id = None
    redirect(URL('system', 'index'))

def index():
    if TEST_USER_ID:
        session.user_id = TEST_USER_ID # Force userID for testing
    user_id = session.user_id
    user_name = session.user_name
    new_user = False
    if user_id == None:
        new_user = True
        # Generating new user
        user_name = uuid.uuid4().hex
        session.user_name = user_name
        # Selecting condition
        session.startTime = datetime.datetime.now()
        session.startTimeUTC = datetime.datetime.utcnow()
        session.userCondition = 2 # TODO randomly select condition
        # add user to DB
        user_id = db.user_info.insert(userId=user_name, userCondition=session.userCondition, initialLogin=session.startTime)
        session.user_id = user_id
        # Log
        log_action(user_id, "start_session", json.dumps({'condition':session.userCondition}))

    else:
        # user already has ID. This means it's a page reload. Log it.
        log_action(user_id, "refresh_page", json.dumps({'condition':session.userCondition}))
    # load problem info
    # TODO retrieve it dynamically
    problem_id = request.vars.problem
    problem = db(db.problem.url_id == problem_id).select().first() 
    if not problem_id or not problem:
        response.status = 404
        redirect(URL('static', '404.html'))
    return dict(user_id=user_id, user_name=user_name, new_user=new_user, problem=problem)

def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    user_id = session.user_id
    userCondition = session.userCondition
    idea_id = 0
    # Get variables from request
    idea = str(request.vars['idea'])
    tags = request.vars['tags[]']
    origin = str(request.vars['origin'])
    sources = request.vars['sources[]']
    dateAdded = datetime.datetime.now()

    if user_id != None:
        # Clean up
        idea = idea.strip()
        tags = tags if isinstance(tags, list) else [tags]
        tags = [str(t) for t in tags]
        if sources:
            sources = sources if isinstance(sources, list) else [sources]
            sources = [int(s) for s in sources]
        
        # Inserting idea
        idea_id = db.idea.insert(
            userId=user_id, 
            idea=idea, 
            dateAdded=dateAdded, 
            userCondition=userCondition, 
            ratings=0, 
            pool=ADD_TO_POOL,
            origin=origin,
            sources=sources)
        # Inserting tags
        for tag in tags:
            tag = __clean_tag(tag)
            tag_id = __insert_or_retrieve_tag_id(tag)
            # Inserting relationships
            db.tag_idea.insert(tag=tag_id, idea=idea_id)
        # If idea was marged, update replacedBy on the original ideas
        if origin == 'merge':
            for source in sources:
                idea = db(db.idea.id == source).select().first()
                idea.replacedBy = idea_id
                idea.update_record()
        idea = dict(id=idea_id, idea=idea, tags=tags)
        # Insert tasks
        __insert_tasks_for_idea(idea, user_id)
        # TODO Update reverse index
        # __update_reverse_index()
        # Log
        log_action(user_id, "add_idea", idea)
    return json.dumps(dict(id=idea_id))

def get_organization_ratio():
    # TODO standardize this into a single variable, perhaps together with 'next_task' (see submit_categorization_task)
    base_weights = dict(
        suggest=0,
        selectBest=1,
        categorize=2
    ) 
    completed = 0
    total = 0
    # Categorization tasks
    categorization_tasks = db(db.categorization.id > 0).select()
    for c in categorization_tasks:
        total += len(base_weights.keys())
        # Update number of completed tasks
        completed += base_weights[c.categorizationType] # base weight. Even if a task is not completed, it may already imply that others have been completed before.
        if c.completed:
            completed += 1
    if total > 0:
        return completed / float(total)
    else:
        # There is no data yet to calculate this.
        return -1

def get_tags():
    term = '%%%s%%' % (request.vars.term.lower())
    tags = db(db.tag.tag.like(term)).select(db.tag.tag)
    tags = [t.tag for t in tags]
    return json.dumps(tags)

def get_suggested_tags():
    text = request.vars.text
    # Get suggested tags
    tags = __rake(text)
    tags = [__clean_tag(t[0]) for t in tags]
    # Submit response
    response.headers['Content-Type'] = 'text/json'
    return json.dumps(tags)

def tag_exists():
    tag = request.vars.tag
    return str(len(db(db.tag.tag == tag).select()) > 0).lower()

def test():
    # Build index of ideas based for each tag
    tags = db(db.tag.id > 0).select()
    for t in tags:
        print(t.tag)
        if ' ' in t.tag: # a change will be necessary
            t.tag = t.tag.replace(' ', '')
            # check if there are duplicates
            conflict = db(db.tag.tag == t.tag).select().first()
            if conflict:
                # there is a conflict. Find all connections that involve the current id
                merge = db(db.tag_idea.tag == t.id).select()
                for m in merge:
                    m.tag = conflict.id
                    m.update_record()
                db(db.tag.id == t.id).delete()
            else:
                # there is no conflict
                t.update_record()


### PRIVATE FUNCTIONS

def __insert_tasks_for_idea(idea, user_id):
    # Insert categorization tasks
    for i in range(0,TASKS_PER_IDEA):
        # insert selectBest types. Categorize tasks will be inserted when these are completed
        microtask.TagSuggestionTask(idea=idea['id'])     

def __clean_tag(tag):
    tag = tag.replace(' ', '') # remove spaces
    tag = tag.lower() # lower case
    tag = ''.join(c for c in tag if c not in punctuation) # remove punctuation
    return tag

def __insert_or_retrieve_tag_id(tag):
    tagResult = db(db.tag.tag == tag).select(db.tag.id)
    if tagResult:
        return tagResult[0].id
    else:
        return db.tag.insert(tag=tag)

# keyword extraction
def __rake(text):
    file = os.path.join(request.folder,'static','SmartStoplist.txt')
    r = rake.Rake(file)
    keywords = r.run(text)
    return keywords

def __update_reverse_index():
    keywords = __rake('A Python module implementation of the Rapid Automatic Keyword Extraction (RAKE) algorithm as described in: Rose, S., Engel, D., Cramer, N., & Cowley, W. (2010). Automatic Keyword Extraction from Individual Documents. In M. W. Berry & J. Kogan (Eds.), Text Mining: Theory and Applications: John Wiley & Sons. Initially by @aneesha, packaged by @tomaspinho')
    return json.dumps(keywords)