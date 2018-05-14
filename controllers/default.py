import uuid
import datetime
import pytz
from tzlocal import get_localzone
import json
from collections import defaultdict
import itertools
from string import punctuation
import rake
import os
import random
import microtask
import user_models
import testproblems

DEBUG = False
if settings['is_development']:
    DEBUG = True # Allow debugging options

NUKE_KEY = 'blastoise'
ADD_TO_POOL = True
TASKS_PER_IDEA = 4 # For each idea that is added, add this number of tasks per kind of task per idea. This will depend on the number of users

def index():
    user_id = session.user_id
    user_name = session.user_name
    new_user = False
    if user_id == None:
        new_user = True
        # Generating new user
        user_name = uuid.uuid4().hex
        user_id = __create_new_user(user_name)
    else:
        # user already has ID. This means it's a page reload. Log it.
        log_action(user_id, "refresh_page", json.dumps({'condition':session.userCondition}))
    # load problem info
    problem_id = request.vars.problem
    problem = db(db.problem.url_id == problem_id).select().first() 
    if not problem_id or not problem:
        redirect(URL('default', 'problems'))
    # Prepare to deliver page
    session.problem_id = problem.id
    # Update page title
    response.title = problem.title
    return dict(
        user_id=user_id, 
        user_name=user_name, 
        new_user=new_user, 
        problem=problem,
        validation=dict(
            data_max = DATA_MAX,
            text_max = TEXT_MAX,
            short_string_max = SHORT_STRING_MAX
        ))

def problems():
    problems = db(db.problem.public == True).select()
    return dict(
        problems=problems, 
        validation=dict(
            data_max = DATA_MAX,
            text_max = TEXT_MAX,
            short_string_max = SHORT_STRING_MAX
        ))

def create_problem():
    title = request.vars['title'].lower()
    description = request.vars['description']
    public = True if request.vars['public'] else False
    url_id = ''.join(title.split())
    # Insert
    db.problem.insert(
        title=title,
        description=description,
        url_id=url_id,
        public=public)
    redirect(URL('default', '?problem=' + url_id))

def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    user_id = session.user_id
    userCondition = session.userCondition
    problem_id = session.problem_id
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
        if origin == 'merge' or origin == 'refinement':
            for source in sources:
                idea = db(db.idea.id == source).select().first()
                idea.replacedBy = idea_id
                idea.update_record()
        idea = dict(id=idea_id, idea=idea, tags=tags)
        # Insert tasks
        __insert_tasks_for_idea(idea, user_id, problem_id)
        # Update user model
        __update_user_model(user_id, problem_id, tags)
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

def check_updates():
    ''' This function checks if new ideas have been added since a given timestamp '''
    # Get timestamp
    client_timestamp = float(request.vars['timestamp'])
    epoch = datetime.datetime(1970,1,1)
    timestamp = epoch + datetime.timedelta(milliseconds=client_timestamp)
    # Adjust to server timezone
    local_tz = get_localzone() 
    timestamp = timestamp.replace(tzinfo=pytz.utc).astimezone(local_tz)
    # Get last idea timestamp
    ideas_post_timestamp = db(db.idea.dateAdded > timestamp).count()
    # print('Ideas post timestamp (%s): %d' % (timestamp, ideas_post_timestamp))
    if ideas_post_timestamp > 0:
        return True
    else:
        return False

def get_all_tags():
    problem_id = session.problem_id
    tags = db((db.tag.id > 0) & (db.tag.problem == problem_id)).select(db.tag.tag, orderby=db.tag.tag)
    tags = [t.tag for t in tags]
    response.headers['Content-Type'] = 'text/json'
    return json.dumps(tags) 

def get_tags():
    term = '%%%s%%' % (request.vars.term.lower())
    tags = db(db.tag.tag.like(term) & (db.tag.problem == problem_id)).select(db.tag.tag)
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
    return str(len(db((db.tag.tag == tag) & (db.tag.problem == problem_id)).select()) > 0).lower()



### DEBUG FUNCTIONS
# These functions only work in development mode (i.e. DEBUG == True)
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

def login_as():
    if DEBUG:
        user_name = request.vars['user_name']
        user_id = None
        user = db(db.user_info.userId == user_name).select().first()
        if user:
            user_id = user.id
        else:
            user_id = __create_new_user(user_name)
        # Set session attributes
        print('Setting session %s and id %d' % (user_name, user_id))
        session.user_name = user_name
        session.user_id = user_id
    redirect(URL('default', 'index'))

def logoff():
    if DEBUG:
        session.user_id = None
        redirect(URL('default', 'index'))

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
            __insert_tasks_for_idea(idea, users[i], problem_id)
    return 'Problem reset!'

    

### PRIVATE FUNCTIONS
def __insert_tags_for_idea(tags, idea_id, problem_id):
    for tag in tags:
        tag = __clean_tag(tag)
        tag_id = __insert_or_retrieve_tag_id(tag, problem_id)
        # Inserting relationships
        db.tag_idea.insert(tag=tag_id, idea=idea_id)

def __create_new_user(user_name):
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
    return user_id

def __insert_tasks_for_idea(idea, user_id, problem_id):
    for i in range(0,TASKS_PER_IDEA):
        # insert selectBest types. Categorize tasks will be inserted when these are completed
        # microtask.TagSuggestionTask(idea=idea['id'], problem=problem_id)     
        # Insert combination tasks
        microtask.RatingTask(idea=idea['id'], problem=problem_id)

def __clean_tag(tag):
    tag = tag.replace(' ', '') # remove spaces
    tag = tag.lower() # lower case
    tag = ''.join(c for c in tag if c not in punctuation) # remove punctuation
    return tag

def __insert_or_retrieve_tag_id(tag, problem_id):
    tagResult = db((db.tag.tag == tag) & (db.tag.problem == problem_id)).select(db.tag.id)
    if tagResult:
        return tagResult[0].id
    else:
        return db.tag.insert(tag=tag, problem=problem_id)

# keyword extraction
def __rake(text):
    file = os.path.join(request.folder,'static','SmartStoplist.txt')
    r = rake.Rake(file)
    keywords = r.run(text)
    return keywords

def __update_reverse_index():
    keywords = __rake('A Python module implementation of the Rapid Automatic Keyword Extraction (RAKE) algorithm as described in: Rose, S., Engel, D., Cramer, N., & Cowley, W. (2010). Automatic Keyword Extraction from Individual Documents. In M. W. Berry & J. Kogan (Eds.), Text Mining: Theory and Applications: John Wiley & Sons. Initially by @aneesha, packaged by @tomaspinho')
    return json.dumps(keywords)

def __update_user_model(user_id, problem_id, tags):
    model = user_models.UserModel(user_id, problem_id)
    model.update(tags)