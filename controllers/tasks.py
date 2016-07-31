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
DEBUG = False
IDEATION_TIME = 1 # in minutes


def enter():
    return dict(ideationTime=IDEATION_TIME)

def intro():
    if session.userCondition == None:
        session.userCondition = __get_condition() # randomly select session

    # change condition if there is a param
    condition_param = request.vars["condition"]
    if condition_param and (int(condition_param) >= 1 and int(condition_param) <= 4):
        userCondition = int(condition_param)
        session.userCondition = userCondition
        __log_action('intro', "force_condition", json.dumps({'new_condition':userCondition}))

    return dict(userCondition=session.userCondition, ideationTime=IDEATION_TIME)

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
    ideas = db(
        (db.idea.userId == userId) & (
            (db.idea.id == db.concept_idea.idea) & 
            (db.concept.id == db.concept_idea.concept))
    ).select(orderby=~db.idea.id, groupby=db.idea.id)
    return dict(userCondition=session.userCondition, ideas=ideas, startTime=session.startTimeUTC, ideationTime=IDEATION_TIME)

def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    userId = session.userId
    userCondition = session.userCondition
    if userId != None:
        idea = request.vars['idea'].strip()
        concepts = request.vars['concepts[]'] if isinstance(request.vars['concepts[]'], list) else [request.vars['concepts[]']]
        dateAdded = datetime.datetime.now()
        __log_action(userId, "add_idea", idea)
        # Inserting idea
        idea_id = db.idea.insert(userId=userId, idea=idea, dateAdded=dateAdded, userCondition=userCondition, ratings=0, pool=ADD_TO_POOL)
        # Inserting concepts
        for concept in concepts:
            concept_id = __insert_or_retrieve_concept_id(concept)
            # Inserting relationships
            db.concept_idea.insert(concept=concept_id, idea=idea_id)

def get_idea():
    '''
    Endpoint for getting someone else's idea
    '''
    userId = session.userId
    userCondition = session.userCondition
    ideas = []
    min_ratings = __get_min_ratings(userId, userCondition)
    max_ratings = __get_max_ratings(userId, userCondition)

    print('Min: %d, max: %d' % (min_ratings, max_ratings))
    # this dictionary specifies how many ideas each condition needs
    threshold = {2:3, 3:1, 4:3}

    if userId != None:

        # Grab ideas. The first loop looks for all ideas with ratings == min_rating. If not enough are found,
        # the next iteration will increase the min_ratings and append the ideas. This will go on until 
        # the threshold is surpassed, or until min_ratings = max_ratings.
        ideas = []
        while len(ideas) < threshold[userCondition] and min_ratings <= max_ratings:
            print("Searching with min = %d" % min_ratings)
            query = ((db.idea.userId != userId) & 
                # (db.idea.userCondition == userCondition) & 
                (db.idea.pool == True))
            if userCondition != 2:
                query = query & (db.idea.ratings == min_ratings) # Condition 2 is decoupled from rating number
            results = db(query).select(orderby='<random>')
            for i in results:
                ideas.append({'idea':i.idea, 'id':i.id})
            min_ratings += 1

    if len(ideas) < threshold[userCondition]:
        __log_action(userId, "get_idea", "[]")
        return json.dumps(dict()) # there are not enough ideas
    else:
        selected = ideas[0:threshold[userCondition]] # get as many ideas as needed
        random.shuffle(selected) # shuffling to avoid the lowest rated appearing in front
        clean_ideas = [{'idea':i['idea'], 'id':i['id']} for i in selected]

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
    ideaIds = [int(x) for x in ideaIds] # Casting to integers
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
    elif userCondition == 4: # rating similarity triplet
        closer_index = int(request.vars['closer_index'])
        confidence = int(request.vars['confidence'])
        farther_index = 1 if closer_index == 2 else 2
        print('Seed: %d, Closer: %d, Farther: %d' % (ideaIds[0], ideaIds[closer_index], ideaIds[farther_index]))
        if len(ideaIds) == 3:
            # insert ratings
            db.idea_triplets.insert(
                userId=userId, 
                dateAdded=date_time,
                ratingType="similarity", 
                seed_idea=ideaIds[0], 
                closer_idea=ideaIds[closer_index], 
                farther_idea=ideaIds[farther_index],
                confidence=confidence)
            # update rating count
            for idea_id in ideaIds:
                idea = db(db.idea.id == idea_id).select().first()
                idea.ratings += 1
                idea.update_record()
        else:
            # Error
            response.status = 500
            return "This rating task requires exactly three ideas"
        __log_action(
                session.userId, 
                "task_completed:similarity", 
                json.dumps({'condition':4, 'triplet': [ideaIds[0],ideaIds[closer_index],ideaIds[farther_index]]})) 


def post_survey():
    __log_action(session.userId, "post_survey", "")
    useful_inspiration = request.vars['usefulInspiration']
    open_ended = request.vars['openEnded']
    print(useful_inspiration)
    print(open_ended)
    db.survey.insert(
        userId=session.userId,
        inspirationUseful=useful_inspiration,
        openComments=open_ended
    )


def final_id():
    # TODO check if 20 minutes have gone by
    # Log actions
    __log_action(session.userId, "time_up", "")
    return session.userId

def get_stats():
    ''' Public API for retrieving the statistics for an user '''
    return json.dumps(dict(fluency=1, breadth=1, depth=1))

def reset():
    if DEBUG:
        session.userId = None
    redirect(URL('tasks', 'index'))

### PRIVATE FUNCTIONS ###

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

# Generic function to get number of ratings. Is used by the next two functions.
def __get_query_ratings(query, userId, condition):
    number = db(
            (db.idea.userId != userId) & 
            # (db.idea.userCondition == condition) & 
            (db.idea.pool == True)
        ).select(query).first()[query]
    return number

def __get_min_ratings(userId, condition):
    min_query = db.idea.ratings.min()
    return __get_query_ratings(min_query, userId, condition)

def __get_max_ratings(userId, condition):
    max_query = db.idea.ratings.max()
    return __get_query_ratings(max_query, userId, condition) 

def __insert_or_retrieve_concept_id(concept):
    conceptResult = db(db.concept.concept == concept).select(db.concept.id)
    if conceptResult:
        return conceptResult[0].id
    else:
        return db.concept.insert(concept=concept)