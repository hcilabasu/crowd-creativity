import uuid
import datetime
import json
import random

'''
User Conditions
1. Nominal Group
2. Idea exposition
3. Originality/Usefulness task
4. Similarity task
5. Choose one task
'''


# CONFIG
ADD_TO_POOL = False # if false, new ideas are not added to the pool of ideas used in the tasks.



def enter():
    return dict()

def intro():
    if session.userCondition == None:
        session.userCondition = __get_condition() # randomly select session

    # change condition if there is a param
    condition_param = request.vars["condition"]
    if condition_param and (int(condition_param) >= 1 and int(condition_param) <= 4):
        userCondition = int(condition_param)
        session.userCondition = userCondition
        __log_action('intro', "force_condition", json.dumps({'new_condition':userCondition}))

    return dict(userCondition=session.userCondition)

def index():
    if session.userCondition == None:
        # go to introduction
        redirect(URL('tasks', 'intro'))
    userId = session.userId
    if userId == None:
        # Generating new user
        userId = uuid.uuid4().hex
        session.userId = userId
        # Selecting condition
        session.startTime = datetime.datetime.now()
        session.startTimeUTC = datetime.datetime.utcnow()
        # add user to DB
        db.user_info.insert(userId=userId, userCondition=session.userCondition, initialLogin=session.startTime)
        __log_action(userId, "start_session", json.dumps({'condition':session.userCondition}))
    else:
        # user already has ID. This means it's a page reload. Log it.
        __log_action(userId, "refresh_page", json.dumps({'condition':session.userCondition}))

    # get user ideas
    ideas = db(db.idea.userId == userId).select()
    return dict(userCondition=session.userCondition, ideas=ideas, startTime=session.startTimeUTC)

def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    userId = session.userId
    userCondition = session.userCondition
    if userId != None:
        idea = request.vars['idea'].strip()
        dateAdded = datetime.datetime.now()
        __log_action(userId, "add_idea", idea)
        ideaId = db.idea.insert(userId=userId, idea=idea, dateAdded=dateAdded, userCondition=userCondition, ratings=0, pool=ADD_TO_POOL)

def get_idea():
    '''
    Endpoint for getting someone else's idea
    '''
    userId = session.userId
    userCondition = session.userCondition
    ideas = []
    min_ratings = __get_min_ratings(userId, userCondition)
    if userId != None:
        ideas = db(
            (db.idea.userId != userId) & 
            (db.idea.userCondition == userCondition) & 
            (db.idea.ratings == min_ratings) &
            (db.idea.pool == True)
        ).select(orderby='<random>')

    # this dictionary specifies how many ideas each condition needs
    # Condition 1 doesn't need any ideas, so threshold is high
    threshold = {1:1000, 2:1, 3:1, 4:2, 5:3}
    if len(ideas) < threshold[userCondition]:
        __log_action(userId, "get_idea", "[]")
        return json.dumps(dict()) # there are not enough ideas
    else:
        selected = ideas[0:threshold[userCondition]] # get as many ideas as needed
        clean_ideas = [{'idea':i.idea, 'id':i.id} for i in selected]

        # log retrieved ideas
        __log_action(userId, "get_idea", json.dumps(clean_ideas))

        return json.dumps(clean_ideas)


def rate_idea():
    '''
    Endpoint for rating an idea
    '''
    userCondition = session.userCondition
    userId = session.userId
    ideaIds = request.vars['ideaIds[]'] if isinstance(request.vars['ideaIds[]'], list) else [request.vars['ideaIds[]']] # expected: array of ids if more than one item. Otherwise, single number
    date_time = datetime.datetime.now()

    if userCondition == 3: # rating originality and usefulness
        originality = request.vars['originality']
        usefulness = request.vars['usefulness']
        if len(ideaIds) == 1:
            # insert ratings
            db.idea_rating.insert(userId=userId, ratingType="originality", rating=originality, dateAdded=date_time, idea=ideaIds[0])
            db.idea_rating.insert(userId=userId, ratingType="usefulness", rating=usefulness, dateAdded=date_time, idea=ideaIds[0])
            # update ratings count
            idea = db(db.idea.id == ideaIds[0]).select().first()
            idea.ratings += 1
            idea.update_record()
        else:
            # Error
            response.status = 500
            return "This rating task requires exactly one idea"
    elif userCondition == 4: # rating similarity in a 7-point scale
        similarity = request.vars['similarity']
        if len(ideaIds) == 2:
            db.idea_rating.insert(
                userId=userId, 
                ratingType="similarity", 
                rating=similarity, 
                dateAdded=date_time, 
                idea=ideaIds[0], 
                relativeTo=ideaIds[1] 
            )
        else:
            # Error
            response.status = 500
            return "This rating task requires exactly two ideas"

def final_id():
    # TODO check if 20 minutes have gone by
    # Log actions
    __log_action(session.userId, "time_up", "")
    return session.userId


def __log_action(user_id, action_name, extra_info):
    print("Logging " + action_name)
    db.action_log.insert(
        userId=user_id, 
        dateAdded=datetime.datetime.now(), 
        actionName=action_name, 
        extraInfo=extra_info
    )

def __get_condition():
    result = []
    while not result:
        print result
        result = db(db.sessionCondition.conditionCount == 0).select(orderby='<random>').first()
        if result:
            result.conditionCount = 1
            result.update_record()
            return result.conditionNumber
        else:
            # there are no conditions left in this block. Reset all
            results = db(db.sessionCondition.conditionCount == 1).select()
            for r in results:
                r.conditionCount = 0
                r.update_record()

def __get_min_ratings(userId, condition):
    min_query = db.idea.ratings.min()
    min_number = db((db.idea.userId != userId) & (db.idea.userCondition == condition) & (db.idea.pool == True)).select(min_query).first()[min_query]
    return min_number