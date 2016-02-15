import uuid
import datetime
import json

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
    if userId == None:
        # Generating new user
        userId = uuid.uuid4().hex
        print("New user: " + userId)
        session.userId = userId
        # Selecting condition
        session.userCondition = 3 # TODO randomly select condition
    userCondition = session.userCondition
        
    return dict(userCondition=userCondition)

def add_idea():
    userId = session.userId
    userCondition = session.userCondition
    if userId != None:
        idea = request.vars['idea']
        dateAdded = datetime.datetime.now()
        db.ideas.insert(userId=userId, idea=idea, dateAdded=dateAdded, userCondition=userCondition)

def new_ideas():
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
    rows = db((db.ideas.dateAdded > lastUpdateTime) &  
              (db.ideas.userCondition == session.userCondition) & 
              (db.ideas.userId != session.userId)).select()
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


