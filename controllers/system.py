import uuid
import datetime
import json

ADD_TO_POOL = True
TEST_USER_ID = 'ac403a5b927b4df6b3d986fae55145e8' # Use None if no test ID is needed

def index():
    if TEST_USER_ID:
        session.userId = TEST_USER_ID # Force userID for testing
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
    userId = session.userId
    userCondition = session.userCondition
    idea_id = 0
    if userId != None:
        idea = request.vars['idea'].strip()
        concepts = request.vars['concepts[]'] if isinstance(request.vars['concepts[]'], list) else [request.vars['concepts[]']]
        origin = request.vars['origin']
        sources = []
        if request.vars['sources[]']:
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
        # If idea was marged, update replacedBy on the original ideas
        if origin == 'merge':
            for source in sources:
                idea = db(db.idea.id == source).select().first()
                idea.replacedBy = idea_id
                idea.update_record()
        # Log
        __log_action(userId, "add_idea", idea)
    return json.dumps(dict(id=idea_id))


def get_user_ideas():
    userId = session.userId
    ideas = db(
        (db.idea.replacedBy == None) &
        (db.idea.userId == userId) & 
        ((db.idea.id == db.concept_idea.idea) & 
            (db.concept.id == db.concept_idea.concept))
    ).select(orderby=db.idea.id, groupby=db.idea.id)
    clean_ideas = [
        dict(id=i.idea.id, 
            idea=i.idea.idea, 
            categories=[concept.concept.concept for concept in i.idea.concept_idea.select()]
        ) for i in ideas]
    return json.dumps(clean_ideas)

def get_idea_by_id():
    id = int(request.vars['id'])

    idea = db((db.idea.id == id) &
                ((db.idea.id == db.concept_idea.idea) & 
                (db.concept.id == db.concept_idea.concept))
    ).select(orderby=~db.idea.id, groupby=db.idea.id).first()

    clean_idea = dict(id=idea.idea.id, 
        idea=idea.idea.idea, 
        categories=[concept.concept.concept for concept in idea.idea.concept_idea.select()])

    return json.dumps(clean_idea)

def get_all_ideas():
    ideas = db((db.idea.id == db.concept_idea.idea) & 
               (db.concept.id == db.concept_idea.concept)
    ).select(orderby=~db.idea.id, groupby=db.idea.id)
    clean_ideas = [dict(id=i.idea.id, idea=i.idea.idea) for i in ideas]
    return json.dumps(clean_ideas)

def get_versioning_structure():
    ''' 
    Return the structure for the versioning panel 
    Structure:
    [
        [{ <-- Level 1 start
            id:31, connections: [{ids:[43,57], type:'merge'}, ...]
         }, 
         {
            id:..., connections: [...]
         }],     
        [ <-- Level 2 start
            ...
        ],     
        ...
    ]

    '''
    # get all ideas
    results = db((db.idea.id == db.concept_idea.idea) & 
               (db.concept.id == db.concept_idea.concept)
    ).select(orderby=db.idea.id, groupby=db.idea.id)
    
    # start aux variables
    levels_map = dict() # key: idea_id, value: level
    levels = []
    # Iterate over each result and build the levels array
    for r in results:
        sources = r.idea.sources
        level = __get_level(r.idea.sources, levels_map)
        # add level to dictionary
        levels_map[r.idea.id] = level
        if level > len(levels)-1: # this is the first idea in a new level
            levels.append([])
        # add idea to level list
        levels[level].append(dict(
            id = r.idea.id,
            connection = dict(
                type= r.idea.origin,
                ids = r.idea.sources
            )
        ))
        # clean_ideas = [dict(id=i.idea.id, idea=i.idea.idea) for i in ideas]
    return json.dumps(levels)




### PRIVATE FUNCTIONS ###

def __get_level(ids, levels_map):
    # Gets the level of an idea based on its sources
    max_level = -1
    for id in ids:
        max_level = max(max_level, levels_map[id])
    return max_level+1

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