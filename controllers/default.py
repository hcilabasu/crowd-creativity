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

def index():
    problems = db(db.problem.public == True).select()
    # Get values if this is a redirect from a failed create problem submission
    title = request.vars['title'] if 'title' in request.vars else ''
    description = request.vars['description'] if 'description' in request.vars else ''
    public = request.vars['public'] == 'True' if 'public' in request.vars else False
    exists = request.vars['exists'] == 'True' if 'exists' in request.vars else False

    return dict(
        problems=problems, 
        validation=dict(
            data_max = DATA_MAX,
            text_max = TEXT_MAX,
            short_string_max = SHORT_STRING_MAX
        ),
        title=title,
        description=description,
        public=public,
        exists=exists)

def create_problem():
    title = request.vars['title'].lower()
    description = request.vars['description']
    public = True if request.vars['public'] else False
    url_id = ''.join(title.split())
    url_id = ''.join([c for c in url_id if c.isalnum()]) # strip non alpha characters
    # Check if URL id already exists
    if db(db.problem.url_id == url_id).select():
        redirect(URL('default', 'index', vars=dict(
            title=title,
            description=description,
            public=public,
            exists=True
        )))
    else:
        # Insert
        db.problem.insert(
            title=title,
            description=description,
            url_id=url_id,
            public=public)
        redirect(URL('brainstorm', url_id))

def error():
    '''
    Must update routes.py to redirect all pages here. e.g.:
    routes_onerror = [
        ('crowdmuse/*', '/error')
    ]
    '''
    code = request.vars.code
    request_url = request.vars.request_url
    full_ticket = request.vars.ticket
    short_ticket = full_ticket.split('.')[-1]
    # Reporting error
    if settings['is_development']:
        link = URL('admin', 'ticket', full_ticket)
    else:
        link = 'mailto:vaugusto@asu.edu'
    return dict(ticket=short_ticket, full_ticket=full_ticket, link=link, code=code)


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