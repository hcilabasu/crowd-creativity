import uuid
import datetime
import json


ADD_TO_POOL = True


def index():
    userId = session.userId
    if userId == None:
        # Generating new user
        userId = uuid.uuid4().hex
        session.userId = userId
        # Selecting condition
        session.startTime = datetime.datetime.now()
        session.startTimeUTC = datetime.datetime.utcnow()
        session.userCondition = 2 # TODO randomly select condition
        # add user to DB
        db.user_info.insert(userId=userId, userCondition=session.userCondition, initialLogin=session.startTime)
        __log_action(userId, "start_session", json.dumps({'condition':session.userCondition}))
    else:
        # user already has ID. This means it's a page reload. Log it.
        __log_action(userId, "refresh_page", json.dumps({'condition':session.userCondition}))
    return dict()


def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    print("here")
    userId = session.userId
    userCondition = session.userCondition
    if userId != None:
        idea = request.vars['idea'].strip()
        concepts = request.vars['concepts[]'] if isinstance(request.vars['concepts[]'], list) else [request.vars['concepts[]']]
        origin = request.vars['origin']
        sources = request.vars['sources[]'] if isinstance(request.vars['sources[]'], list) else [request.vars['sources[]']]
        sources = [int(s) for s in sources]
        dateAdded = datetime.datetime.now()
        # Inserting idea
        idea_id = db.idea.insert(
            userId=userId, 
            idea=idea, 
            dateAdded=dateAdded, 
            userCondition=userCondition, 
            ratings=0, 
            pool=ADD_TO_POOL,
            origin=origin,
            sources=sources)
        # Inserting concepts
        for concept in concepts:
            concept_id = __insert_or_retrieve_concept_id(concept)
            # Inserting relationships
            db.concept_idea.insert(concept=concept_id, idea=idea_id)
        # Log
        __log_action(userId, "add_idea", idea)


def get_user_ideas():
    userId = session.userId
    ideas = db(
        (db.idea.userId == userId) & (
            (db.idea.id == db.concept_idea.idea) & 
            (db.concept.id == db.concept_idea.concept))
    ).select(orderby=db.idea.id, groupby=db.idea.id)
    clean_ideas = [
        dict(id=i.idea.id, 
            idea=i.idea.idea, 
            categories=[concept.concept.concept for concept in i.idea.concept_idea.select()]
        ) for i in ideas]
    return json.dumps(clean_ideas)

def get_all_ideas():
    userId = session.userId
    ideas = db((db.idea.id == db.concept_idea.idea) & 
               (db.concept.id == db.concept_idea.concept)
    ).select(orderby=~db.idea.id, groupby=db.idea.id)
    clean_ideas = [dict(id=i.idea.id, idea=i.idea.idea) for i in ideas]
    return json.dumps(clean_ideas)


### PRIVATE FUNCTIONS ###

def __log_action(user_id, action_name, extra_info):
    print("Logging " + action_name)
    db.action_log.insert(
        userId=user_id, 
        dateAdded=datetime.datetime.now(), 
        actionName=action_name, 
        extraInfo=extra_info
    )

def __insert_or_retrieve_concept_id(concept):
    conceptResult = db(db.concept.concept == concept).select(db.concept.id)
    if conceptResult:
        return conceptResult[0].id
    else:
        return db.concept.insert(concept=concept)