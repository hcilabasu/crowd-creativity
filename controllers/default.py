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
    short_ticket = 'There is none. Oh no!' if not full_ticket else full_ticket.split('.')[-1]
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
        session.user_name = user_name
        session.user_id = user_id
    redirect(URL('default', 'index'))

def logoff():
    if DEBUG:
        session.user_id = None
        redirect(URL('default', 'index'))