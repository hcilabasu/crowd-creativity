import uuid
import datetime
import json
from collections import defaultdict
import itertools

ADD_TO_POOL = True
TEST_USER_ID = 'testuser1' # Use None if no test ID is needed

TASKS_PER_IDEA = 2 # For each idea that is added, add this number of tasks per kind of task per idea
SIZE_OVERLAP = 2 # size of permutation to be added for the solution space overview (e.g. when = 2, the structure keep track of the count of pairs of concepts)

def index():
    if TEST_USER_ID:
        session.user_id = TEST_USER_ID # Force userID for testing
    user_id = session.user_id
    if user_id == None:
        # Generating new user
        user_id = uuid.uuid4().hex
        session.user_id = user_id
        # Selecting condition
        session.startTime = datetime.datetime.now()
        session.startTimeUTC = datetime.datetime.utcnow()
        session.userCondition = 2 # TODO randomly select condition
        # add user to DB
        db.user_info.insert(userId=user_id, userCondition=session.userCondition, initialLogin=session.startTime)
        __log_action(user_id, "start_session", json.dumps({'condition':session.userCondition}))
    else:
        # user already has ID. This means it's a page reload. Log it.
        __log_action(user_id, "refresh_page", json.dumps({'condition':session.userCondition}))
    return dict(user_id=user_id)


def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    user_id = session.user_id
    userCondition = session.userCondition
    idea_id = 0
    if user_id != None:
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
            userId=user_id, 
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
        # Insert tasks
        __insert_tasks_for_idea(idea_id, user_id)
        # Log
        __log_action(user_id, "add_idea", idea)
    return json.dumps(dict(id=idea_id))


def get_user_ideas():
    user_id = session.user_id
    ideas = db(
        (db.idea.replacedBy == None) &
        (db.idea.userId == user_id) & 
        ((db.idea.id == db.concept_idea.idea) & 
            (db.concept.id == db.concept_idea.concept))
    ).select(orderby=db.idea.id, groupby=db.idea.id)
    clean_ideas = [
        dict(id=i.idea.id,
            userId=i.idea.userId, 
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
        userId=idea.idea.userId,
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

def get_suggested_tasks():
    user_id = session.user_id
    # retrieve tasks already completed
    completed_ratings = [row.idea for row in db(db.idea_rating.completedBy == user_id).select(db.idea_rating.idea)]
    # retrieve tasks TODO make sure the user only gets tasks he did not yet complete
    rating_tasks_results = db(
        (db.idea_rating.completed == False) & 
        (db.idea_rating.idea == db.idea.id) &
        ~(db.idea_rating.idea.belongs(completed_ratings))
    ).select(groupby=db.idea_rating.idea)
    rating_tasks = [dict(task_id=r.idea_rating.id, idea=r.idea.idea, idea_id=r.idea.id) for r in rating_tasks_results]
    return json.dumps(dict(rating=rating_tasks))

def submit_rating_task():
    idea_id = request.vars['idea_id']
    originality = int(request.vars['originality'])
    usefulness = int(request.vars['usefulness'])
    date_completed = datetime.datetime.now()
    user_id = session.user_id
    # retrieve first available task for this idea
    rating = db((db.idea_rating.idea == idea_id) & (db.idea_rating.completed == False)).select().first()
    if rating:
        # rating found. Update record
        rating.completed = True
        rating.ratingOriginality = originality
        rating.ratingUsefulness = usefulness
        rating.dateCompleted = date_completed
        rating.completedBy = user_id
        rating.update_record()
    else:
        # there were no available ratings for this idea (other people already did it). Create a new one
        db.idea_rating.insert(
            idea=idea_id, 
            completed=True, 
            ratingOriginality=originality, 
            ratingUsefulness=usefulness, 
            dateCompleted=date_completed, 
            completedBy=user_id)
    return 'ok'

def get_solution_space():
    categories = db(db.concept.id > 0).select().as_list()
    ''' Structure:
    connections = [{
        concepts: [...]
        n: number
    },
    ...
    ] '''
    # get ideas with respective concepts
    ideas = db((db.idea.id == db.concept_idea.idea) & 
        (db.concept.id == db.concept_idea.concept)
    ).select(orderby=~db.idea.id, groupby=db.idea.id)
    # extract tags
    i = 0
    max_n = 0
    connections = dict()
    for idea in ideas:
        tags = list()
        for concept in idea.idea.concept_idea.select():
            concept = concept.concept.concept.lower()
            tags.append(concept)
        tags.sort() # this contains a sorted array of tags for idea
        # insert into data structure
        for i in range(1,SIZE_OVERLAP+1): # this will iterate over all unique permutations of the tags, inserting them in pairs
            for combination in itertools.combinations(tags, i):
                key = '|'.join(combination)
                if key not in connections.keys():
                    connections[key] = dict(concepts=combination, n=0)
                n = connections[key]['n'] + 1
                connections[key]['n'] = n
                if n > max_n:
                    max_n = n
    connections = [v for (k,v) in connections.items()]
    return json.dumps(dict(categories=categories, connections=connections, max_n=max_n))


### PRIVATE FUNCTIONS ###

def __insert_tasks_for_idea(idea_id, user_id):
    # Inser rating tasks
    for i in range(0,TASKS_PER_IDEA):
        db.idea_rating.insert(idea=idea_id, completed=False)

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