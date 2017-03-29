import uuid
import datetime
import json
from collections import defaultdict
import itertools
from string import punctuation

DEBUG = False # Add debug mode
NUKE_KEY = 'blastoise'
ADD_TO_POOL = True
TEST_USER_ID = 'testuser2' # Use None if no test ID is needed
TASKS_PER_IDEA = 2 # For each idea that is added, add this number of tasks per kind of task per idea. This will depend on the number of users
SIZE_OVERLAP = 2 # size of permutation to be added for the solution space overview (e.g. when = 2, the structure keep track of the count of pairs of tags)

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
        tags = request.vars['tags[]'] if isinstance(request.vars['tags[]'], list) else [request.vars['tags[]']]
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
        # Inserting tags
        for tag in tags:
            tag = __clean_tag(tag)
            tag_id = __insert_or_retrieve_tag_id(tag)
            # Inserting relationships
            db.tag_idea.insert(tag=tag_id, idea=idea_id)
        # If idea was marged, update replacedBy on the original ideas
        if origin == 'merge':
            for source in sources:
                idea = db(db.idea.id == source).select().first()
                idea.replacedBy = idea_id
                idea.update_record()
        idea = dict(id=idea_id, idea=idea, tags=tags)
        # Insert tasks
        __insert_tasks_for_idea(idea, user_id)
        # Log
        __log_action(user_id, "add_idea", idea)
    return json.dumps(dict(id=idea_id))


def get_ideas():
    user_id = session.user_id
    added_by = request.vars.added_by
    print(added_by)
    query = (db.idea.replacedBy == None) & ((db.idea.id == db.tag_idea.idea) & (db.tag.id == db.tag_idea.tag))
    if added_by:
        query = query & (db.idea.userId == user_id)

    ideas = db(query).select(orderby=db.idea.id, groupby=db.idea.id)
    clean_ideas = [
        dict(id=i.idea.id,
            userId=i.idea.userId, 
            idea=i.idea.idea, 
            tags=[tag.tag.tag for tag in i.idea.tag_idea.select()]
        ) for i in ideas]
    return json.dumps(clean_ideas)

def get_idea_by_id():
    id = int(request.vars['id'])

    idea = db((db.idea.id == id) &
                ((db.idea.id == db.tag_idea.idea) & 
                (db.tag.id == db.tag_idea.tag))
    ).select(orderby=~db.idea.id, groupby=db.idea.id).first()

    clean_idea = dict(id=idea.idea.id, 
        idea=idea.idea.idea, 
        userId=idea.idea.userId,
        tags=[tag.tag.tag for tag in idea.idea.tag_idea.select()])

    return json.dumps(clean_idea)

def get_all_ideas():
    ideas = db((db.idea.id == db.tag_idea.idea) & 
               (db.tag.id == db.tag_idea.tag)
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
    results = db((db.idea.id == db.tag_idea.idea) & 
               (db.tag.id == db.tag_idea.tag)
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
    # rating tasks
    rating_tasks = [] #__get_rating_tasks(user_id)
    # Categorizations tasks
    categorization_tasks = __get_categorization_tasks(user_id)
    # Join all tasks
    tasks = categorization_tasks + rating_tasks
    return json.dumps(tasks)

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

def submit_categorization_task():
    idea_id = request.vars['idea_id']
    type = request.vars['type']
    next_type = dict(suggest='selectBest', selectBest='categorize', categorize='categorize')[type]
    date_completed = datetime.datetime.now()
    user_id = session.user_id
    suggested_tags = None
    chosen_tags = None
    categorized_tags = None
    completed = True
    # Check the type of task submitted and do task specific action
    # TODO clean up great number of calls
    if type == 'suggest':
        suggested_tags = request.vars['suggested_tags[]'] if isinstance(request.vars['suggested_tags[]'], list) else [request.vars['suggested_tags[]']]
    elif type == 'selectBest' or type == 'categorize':
        chosen_tags = request.vars['chosen_tags[]'] if isinstance(request.vars['chosen_tags[]'], list) else [request.vars['chosen_tags[]']]
    # retrieve task
    task = db((db.categorization.categorizationType == type) &(db.categorization.idea == idea_id) & (db.categorization.completed == False)).select().first()
    if task:
        # a task was found. Update it
        task.completed = True
        if suggested_tags:
            task.suggestedTags = suggested_tags
        if chosen_tags and type == 'selectBest':
            task.chosenTags = chosen_tags
        if chosen_tags and type == 'categorize':
            task.categorized = chosen_tags
        task.completedBy = user_id
        task.update_record()
    
    # Check if all suggest tasks for this idea have been completed. If so, move to next kind of task
    tasks = db((db.categorization.categorizationType == type) & (db.categorization.idea == idea_id) & (db.categorization.completed == False)).select()
    if len(tasks) == 0:
        # retrieve all tasks
        tasks = db((db.categorization.categorizationType == type) & (db.categorization.idea == idea_id)).select()
        # gather tags
        suggestedTags = set()
        if type == 'suggest':
            # All suggest tasks have been done. Merge them into the suggestedTags field.
            for t in tasks:
                # TODO do some processing to reduce redundancies
                suggestedTags = suggestedTags.union(set(t.suggestedTags))
        elif type == 'selectBest':
            # All selectBest tasks have been done. Keep only the n most voted into the chosenTags field
            count = defaultdict(int)
            for t in tasks:
                for c in t.chosenTags:
                    count[c] += 1
            # keep the top n
            sorted_items = sorted(count.items(), key=lambda x:x[1], reverse=True)[0:3]
            chosen_tags = [c[0] for c in sorted_items]
        elif type == 'categorize':
            # All categorize tasks have been done. Finalize processing and recategorize ideas.
            # Run Global Structure Inference (Chilton et al., 2013)
            completed = True
            # Step 1: remove insignificant categories

            # Step 2: remove duplicate categories

            # Step 3: create nested categories

            
        # update 
        for t in tasks:
            t.categorizationType = next_type
            t.completed = completed
            t.completedBy = None
            if type == 'suggest':
                t.suggestedTags = list(suggestedTags)
            if type == 'selectBest':
                t.chosenTags = chosen_tags
            t.update_record()
        # All have been completed. Upgrade them if applicable
        __log_action(user_id, "upgrade_categorization_Task", json.dumps({'condition':session.userCondition, 'idea_id': idea_id, 'new_type': next_type}))
            

def get_solution_space():
    ''' Structure:
    connections = [{
        tags: [...]
        n: number
    },
    ...
    ] '''
    tags = db(db.tag.id > 0).select().as_list()
    # get ideas with respective tags
    ideas = db((db.idea.id == db.tag_idea.idea) & 
        (db.tag.id == db.tag_idea.tag)
    ).select(orderby=~db.idea.id, groupby=db.idea.id)
    # extract tags
    i = 0
    max_n = 0
    connections = dict()
    for idea in ideas:
        idea_tags = list()
        for tag in idea.idea.tag_idea.select():
            tag = tag.tag.tag.lower()
            idea_tags.append(tag)
        idea_tags.sort() # this contains a sorted array of tags for idea
        # insert into data structure
        for i in range(1,SIZE_OVERLAP+1): # this will iterate over all unique permutations of the tags, inserting them in pairs
            for combination in itertools.combinations(idea_tags, i):
                key = '|'.join(combination)
                if key not in connections.keys():
                    connections[key] = dict(tags=combination, n=0)
                n = connections[key]['n'] + 1
                connections[key]['n'] = n
                if n > max_n:
                    max_n = n
    connections = [v for (k,v) in connections.items()]
    return json.dumps(dict(tags=tags, connections=connections, max_n=max_n))

def get_ideas_per_tag():
    '''
    Retrieve all ideas that have the tags passed as parameter
    '''
    tag = request.vars['tag']
    if not tag: #no tag was passed as param. Return empty
        return json.dumps([])
    # There is a tag. Retrieve ideas
    ideas = db((db.idea.id == db.tag_idea.idea) & 
        (db.tag.id == db.tag_idea.tag) &
        (db.tag.tag == tag)
    ).select(orderby=~db.idea.id, groupby=db.idea.id)

    clean_ideas = [
        dict(id=i.idea.id,
            userId=i.idea.userId, 
            idea=i.idea.idea, 
            tags=[tag.tag.tag for tag in i.idea.tag_idea.select()]
        ) for i in ideas]
    return json.dumps(clean_ideas)

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
    print('Ratio:')
    print(completed)
    print(total)
    print('---')
    if total > 0:
        return completed / float(total)
    else:
        # There is no data yet to calculate this.
        return -1

### PRIVATE FUNCTIONS ###
def __get_rating_tasks(user_id):
    # retrieve tasks already completed
    completed_ratings = [row.idea for row in db(db.idea_rating.completedBy == user_id).select(db.idea_rating.idea)]
    # retrieve tasks
    rating_tasks_results = db(
        (db.idea_rating.completed == False) & 
        (db.idea_rating.idea == db.idea.id) &
        ~(db.idea_rating.idea.belongs(completed_ratings))
    ).select(groupby=db.idea_rating.idea)
    return  [dict(type="rating", task_id=r.idea_rating.id, idea=r.idea.idea, idea_id=r.idea.id) for r in rating_tasks_results]

def __get_categorization_tasks(user_id):
    # retrieve tasks already completed
    completed = [row.idea for row in db(db.categorization.completedBy == user_id).select(db.categorization.idea)]
    # retrieve tasks
    tasks_results = db(
        (db.categorization.completed == False) &  # Uncompleted tasks
        (db.categorization.idea == db.idea.id) & # Attach to idea
        ~((db.idea.userId == user_id) & (db.categorization.categorizationType == 'suggest')) & # user has not authored this idea if this is a suggest type
        ~(db.categorization.idea.belongs(completed)) # User has not yet completed it
    ).select(groupby=db.categorization.idea)
    return [dict(type=r.categorization.categorizationType, 
        suggested_tags=r.categorization.suggestedTags, 
        chosen_tags=r.categorization.chosenTags,
        task_id=r.categorization.id, 
        idea=r.idea.idea, 
        idea_id=r.idea.id) for r in tasks_results]

def __insert_tasks_for_idea(idea, user_id):
    # Insert categorization tasks
    for i in range(0,TASKS_PER_IDEA):
        # insert selectBest types. Categorize tasks will be inserted when these are completed
        db.categorization.insert(idea=idea['id'], completed=False, suggestedTags=idea['tags'], categorizationType='suggest')
    # Insert rating tasks
    for i in range(0,TASKS_PER_IDEA):
        db.idea_rating.insert(idea=idea['id'], completed=False)

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

def __clean_tag(tag):
    tag = tag.replace(' ', '') # remove spaces
    tag = tag.lower() # lower case
    tag = ''.join(c for c in tag if c not in punctuation) # remove punctuation
    return tag

def __insert_or_retrieve_tag_id(tag):
    tagResult = db(db.tag.tag == tag).select(db.tag.id)
    if tagResult:
        return tagResult[0].id
    else:
        return db.tag.insert(tag=tag)