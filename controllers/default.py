import uuid
import datetime
import json
import random
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


# -*- coding: utf-8 -*-
# this file is released under public domain and you can use without limitations

#########################################################################
## This is a sample controller
## - index is the default action of any application
## - user is required for authentication and authorization
## - download is for downloading files uploaded in the db (does streaming)
#########################################################################


def index():
    userId = session.userId
    # initialize categories list in session
    if not session.categories:
        session.categories = []
    if userId == None:
        # Generating new user
        userId = uuid.uuid4().hex
        print("New user: " + userId)
        session.userId = userId
        # Selecting condition
        session.userCondition = 3 # TODO randomly select condition
    userCondition = session.userCondition

    # get user ideas
    ideas = db(db.idea.userId == userId).select()
    # get user categories
    category_idea = db((db.idea.id==db.category_idea.idea) & (db.category.id==db.category_idea.category))
    category_results = category_idea(db.idea.userId==userId).select(db.category.category)
    categories = [d.category for d in category_results] 
    for cat in session.categories:
        categories.append(cat)
    return dict(userCondition=userCondition, ideas=ideas, categories=categories)

def test():
    return db(db.idea.userId == session.userId).select()

def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    userId = session.userId
    userCondition = session.userCondition
    if userId != None:
        idea = request.vars['idea']
        category1 = request.vars['category1']
        category2 = request.vars['category2']
        dateAdded = datetime.datetime.now()
        ideaId = db.idea.insert(userId=userId, idea=idea, dateAdded=dateAdded, userCondition=userCondition)
        # Get category Ids
        category1_id = __insert_or_retrieve_category_id(category1)
        if category2: # category 2 is optional
            category2_id = __insert_or_retrieve_category_id(category2)
        # insert relationship
        db.category_idea.insert(category=category1_id, idea=ideaId)
        if category2: # insert only if there was one
            db.category_idea.insert(category=category2_id, idea=ideaId)

def get_category():
    # calculate the least used category
    category_idea = db((db.idea.id==db.category_idea.idea) & (db.category.id==db.category_idea.category))
    idea_categories = category_idea(db.idea.userCondition == 3).select(db.category.category, db.category.id)
    count = dict()
    # get all user categories
    used_categories = session.categories # get hint categories
    category_idea = db((db.idea.id==db.category_idea.idea) & (db.category.id==db.category_idea.category))
    category_results = category_idea(db.idea.userId==session.userId).select(db.category.category) # get user generated categories
    for cat in category_results:
        used_categories.append(cat.category)
    # Count categories to find least used ones
    for cat in idea_categories:
        if not cat.category in session.categories:
            if not cat.category in count.keys():
                count[cat.category] = 0
            count[cat.category] += 1
    if len(count.keys()):
        min_value = min(count.itervalues())
        min_cat = [k for k, v in count.iteritems() if v == min_value]
        category = random.choice(min_cat)
        cat_id = [d.id for d in idea_categories if d.category == category][0] # getting category id
        session.categories.append(category)
        return json.dumps(dict(category=category, id=cat_id)) # randomly choose an element if there's a tie
    else:
        return json.dumps(dict())

def matrix():
    # get categories
    categories_result = db(db.category.id > 0).select()
    categories = [d.category for d in categories_result]
    ids = [d.id for d in categories_result]
    # this maps a category id to a matrix cell
    cat_map = {d.id : n for (d,n) in zip(categories_result, range(0, len(categories_result)))}

    # get map between ideas and categories
    idea_categories_results = db(db.category_idea.id > 0).select()
    idea_categories = [(d.idea, d.category) for d in idea_categories_results]
    idea_category_map = __build_idea_category_map(idea_categories)

    # build matrix
    connections = db(db.category_idea.id > 0)
    matrix = [[0 for x in xrange(len(categories))] for x in xrange(len(categories))]
    for idea in idea_category_map.keys():
        cell = idea_category_map[idea]
        print(cat_map[cell[0]])
        if len(cell) == 1:
            matrix[cat_map[cell[0]]][cat_map[cell[0]]] += 1
        else:
            matrix[cat_map[cell[0]]][cat_map[cell[1]]] += 1
            matrix[cat_map[cell[1]]][cat_map[cell[0]]] += 1
    return json.dumps(dict(categories=categories, matrix=matrix, ids=ids))

def __build_idea_category_map(idea_category):
    ic_map = dict()
    for t in idea_category:
        if not t[0] in ic_map:
            ic_map[t[0]] = []
        ic_map[t[0]].append(t[1])
    return ic_map


def __insert_or_retrieve_category_id(category):
    categoryResults = db(db.category.category == category).select(db.category.id)
    if categoryResults:
        return categoryResults[0].id
    else:
        return db.category.insert(category=category)

def new_ideas():
    '''
    Endpoint for retrieving most recent ideas (given a timestamp)
    '''
    # Get last update time
    rawLastUpdateTime = request.vars["lastUpdateTime"]
    print("Last: " + str(rawLastUpdateTime))
    if rawLastUpdateTime == None or not rawLastUpdateTime:
        lastUpdateTime = datetime.datetime.min
    else:
        lastUpdateTime = datetime.datetime.strptime(rawLastUpdateTime, '%Y-%m-%d %H:%M:%S.%f') #"2016-02-09 16:15:59.497000
        # Subtract a couple of seconds to account for any conflicts
        lastUpdateTime = lastUpdateTime - datetime.timedelta(seconds=2)
        print("Last (offset): " + str(lastUpdateTime))
        
    # Retrieving new ideas
    rows = db((db.idea.dateAdded > lastUpdateTime) &  
              (db.idea.userCondition == session.userCondition) & 
              (db.idea.userId != session.userId)).select()
    print("Returned results: " + str(len(rows)))
    ideas = []
    for row in rows: 
        ideas.append(row.idea)
    
    current_time = datetime.datetime.now()
    return json.dumps(dict(ideas=ideas, lastUpdate=str(current_time)))

def user():
    """
    exposes:
    http://..../[app]/default/user/login
    http://..../[app]/default/user/logout
    http://..../[app]/default/user/register
    http://..../[app]/default/user/profile
    http://..../[app]/default/user/retrieve_password
    http://..../[app]/default/user/change_password
    http://..../[app]/default/user/bulk_register
    use @auth.requires_login()
        @auth.requires_membership('group name')
        @auth.requires_permission('read','table name',record_id)
    to decorate functions that need access control
    also notice there is http://..../[app]/appadmin/manage/auth to allow administrator to manage users
    """
    return dict(form=auth())


@cache.action()
def download():
    """
    allows downloading of uploaded files
    http://..../[app]/default/download/[filename]
    """
    return response.download(request, db)


def call():
    """
    exposes services. for example:
    http://..../[app]/default/call/jsonrpc
    decorate with @services.jsonrpc the functions to expose
    supports xml, json, xmlrpc, jsonrpc, amfrpc, rss, csv
    """
    return service()


