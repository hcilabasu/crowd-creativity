import uuid
import datetime
import pytz
import json
import itertools
import rake
import os
import random
import microtask
import user_models
import testproblems
import util
from tzlocal import get_localzone
from collections import defaultdict
from string import punctuation

NUKE_KEY = 'blastoise'
ADD_TO_POOL = False
TASKS_PER_IDEA = 4 # For each idea that is added, add this number of tasks per kind of task per idea. This will depend on the number of users
DEBUG = False
if settings['is_development']:
    DEBUG = True # Allow debugging options

def index():
    user_id = session.user_id
    user_name = session.user_name
    problem_title = request.args(0)
    new_user = False
    browser = request.env.http_user_agent

    # load problem info
    problem = db(db.problem.url_id == problem_title).select().first() 
    if not problem_title or not problem:
        redirect(URL('default', 'index'))
    
    # Check if the user exists
    if user_id == None:
        new_user = True
        # Generating new user
        user_name = uuid.uuid4().hex
        user_id = __create_new_user(user_name)
        log_action(user_id, problem.id, "new_user", {'user_name': user_name, 'browser': browser})
    else:
        # user already has ID. This means it's a page reload. Log it.
        log_action(user_id, problem.id, "refresh_page", {'user_name': user_name, 'browser': browser})

    # Update page title
    response.title = problem.title
    return dict(
        user_id=user_id, 
        user_name=user_name, 
        new_user=new_user, 
        study_session=problem.study_session,
        problem=problem,
        validation=dict(
            data_max = DATA_MAX,
            text_max = TEXT_MAX,
            short_string_max = SHORT_STRING_MAX
        ))

def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    user_id = session.user_id
    userCondition = session.userCondition
    problem_id = util.get_problem_id(request)
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
            problem=problem_id,
            ratings=0, 
            pool=ADD_TO_POOL,
            origin=origin,
            sources=sources)
        # Inserting tags
        __insert_tags_for_idea(tags, idea_id, problem_id)
        # If idea was merged, update replacedBy on the original ideas
        # if origin == 'merge' or origin == 'refinement':
        #     for source in sources:
        #         source_idea = db(db.idea.id == source).select().first()
        #         source_idea.replacedBy = idea_ide).select().first()
        #         source_idea.replacedBy = idea_id
        #         source_idea.update_record()
        idea = dict(id=idea_id, idea=idea, tags=tags)
        # Insert tasks
        __insert_tasks_for_idea(idea, user_id, problem_id, ADD_TO_POOL)
        # Update user model
        __update_user_model(user_id, problem_id, tags)
        # Log
        log_action(user_id, problem_id, "add_idea", idea)
    return json.dumps(dict(id=idea_id))

def check_updates():
    ''' This function checks if new ideas have been added since a given timestamp '''
    problem_id = util.get_problem_id(request)
    # Get timestamp
    client_timestamp = float(request.vars['timestamp'])
    epoch = datetime.datetime(1970,1,1)
    timestamp = epoch + datetime.timedelta(milliseconds=client_timestamp)
    # Adjust to server timezone
    local_tz = get_localzone() 
    timestamp = timestamp.replace(tzinfo=pytz.utc).astimezone(local_tz)
    # Get last idea timestamp
    ideas_post_timestamp = db((db.idea.dateAdded > timestamp) & (db.idea.problem == problem_id)).count()
    if ideas_post_timestamp > 0:
        return True
    else:
        return False

def get_all_tags():
    user_id = session.user_id
    problem_id = util.get_problem_id(request)
    tags = db((db.idea.id == db.tag_idea.idea) & 
        (db.tag.id == db.tag_idea.tag) &
        (db.idea.problem == problem_id) & 
        ((db.idea.pool == True) | (db.idea.userId == user_id))
    ).select(db.tag.tag, orderby=db.tag.tag, groupby=db.tag.id)
    tags = [t.tag for t in tags]
    response.headers['Content-Type'] = 'text/json'
    return json.dumps(tags) 

def check_tag():
    problem_id = util.get_problem_id(request)
    tag = request.vars['tag']
    # Check if the tag has been replaced by another tag
    tag = db((db.tag.tag == tag) & (db.tag.problem == problem_id)).select().first()
    replacedBy = None
    if tag and tag.replacedBy:
        replacedBy = db(db.tag.id == tag.replacedBy).select().first().tag
    # Send response
    response.headers['Content-Type'] = 'text/json'
    return json.dumps(dict(replacedBy=replacedBy))

def reset_problem():
    if not DEBUG:
        return 'Not debug'
    url_id = request.vars['url']
    if not url_id:
        return 'Inform URL ID'
    if not hasattr(testproblems, url_id):
        return 'Not a test problem'
    # Delete problem in database
    db_problem = db(db.problem.url_id == url_id).delete()
    # Create problem
    problem_id = db.problem.insert(
        title = url_id,
        description = url_id,
        url_id = url_id,
        public = True)
    # Get test problem data
    tag_sequences = getattr(testproblems, url_id)
    # create users
    users = dict()
    for i in range(len(tag_sequences)):
        # Create users name
        user_name = 'testuser' + str(i)
        # check if user already exists
        db_user = db(db.user_info.userId == user_name).select().first()
        if not db_user:
            user_id = db.user_info.insert(
                userId=user_name,
                userCondition=0,
                initialLogin=datetime.datetime.now())
        else:
            user_id = db_user.id
        # Keep track of the DB id for each testuser
        users[i] = user_id
    # insert ideas
    for i, user_tags in enumerate(tag_sequences): # Iterates over each row (user) in the test problem
        for tags in user_tags: # Iterates over each tag list for a given user
            idea_id = db.idea.insert(
                userId=users[i],
                idea=str(tags),
                dateAdded=datetime.datetime.now(), 
                userCondition=0, 
                problem=problem_id,
                ratings=0, 
                pool=True,
                origin='original',
                sources=[])
            __insert_tags_for_idea(tags, idea_id, problem_id)
            __update_user_model(users[i], problem_id, tags)
            # Insert tasks
            idea = dict(id=idea_id, idea=str(tags), tags=tags)
            __insert_tasks_for_idea(idea, users[i], problem_id, True)
    return 'Problem reset!'


### PRIVATE FUNCTIONS
def __insert_tags_for_idea(tags, idea_id, problem_id):
    for tag in tags:
        tag = __clean_tag(tag)
        tag_id = __insert_or_retrieve_tag_id(tag, problem_id)
        print(tag_id)
        # Inserting relationships
        db.tag_idea.insert(tag=tag_id[0], idea=idea_id, replaced_tag=tag_id[1])

def __create_new_user(user_name):
    session.user_name = user_name
    # Selecting condition
    session.startTime = datetime.datetime.now()
    session.startTimeUTC = datetime.datetime.utcnow()
    session.userCondition = 2 # TODO randomly select condition
    # add user to DB
    user_id = db.user_info.insert(userId=user_name, userCondition=session.userCondition, initialLogin=session.startTime)
    session.user_id = user_id
    return user_id

def __insert_tasks_for_idea(idea, user_id, problem_id, add_to_pool):
    for i in range(0,TASKS_PER_IDEA):
        # insert selectBest types. Categorize tasks will be inserted when these are completed
        # microtask.TagSuggestionTask(idea=idea['id'], problem=problem_id)     
        # Insert combination tasks
        microtask.RatingTask(idea=idea['id'], problem=problem_id, pool=add_to_pool)

def __clean_tag(tag):
    tag = tag.replace(' ', '') # remove spaces
    tag = tag.lower() # lower case
    tag = ''.join(c for c in tag if c not in punctuation) # remove punctuation
    return tag

def __insert_or_retrieve_tag_id(tag, problem_id):
    ''' 
    Returns a tuple with the id of the tag in position 0, 
    and the id of the original tag if it's been replaced (through the tag manager).
    If the tag has not been replaced, position 1 will hold None.
    '''
    tagResult = db((db.tag.tag == tag) & (db.tag.problem == problem_id)).select()
    if tagResult:
        if tagResult[0].replacedBy != None:
            return (tagResult[0].replacedBy, tagResult[0].id)
        return (tagResult[0].id, None)
    else:
        return (db.tag.insert(tag=tag, problem=problem_id), None)

def __update_user_model(user_id, problem_id, tags):
    model = user_models.UserModel(user_id, problem_id)
    model.update(tags)