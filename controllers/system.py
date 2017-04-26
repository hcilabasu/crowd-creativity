import uuid
import datetime
import json
from collections import defaultdict
import itertools
from string import punctuation
import rake
import os
import random

DEBUG = True # Add debug mode
NUKE_KEY = 'blastoise'
ADD_TO_POOL = True
TEST_USER_ID = None #'testuser1' # Use None if no test ID is needed
TASKS_PER_IDEA = 2 # For each idea that is added, add this number of tasks per kind of task per idea. This will depend on the number of users
SIZE_OVERLAP = 2 # size of permutation to be added for the solution space overview (e.g. when = 2, the structure keep track of the count of pairs of tags)
SOLUTION_SPACE_MAX_TAGS = 200


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
    new_user = False
    if user_id == None:
        new_user = True
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
    # load problem info
    # TODO retrieve it dynamically
    problem_id = request.vars.problem
    problem = db(db.problem.url_id == problem_id).select().first() 
    if not problem_id or not problem:
        response.status = 404
        redirect(URL('static', '404.html'))
    return dict(user_id=user_id, new_user=new_user, problem=problem)

def add_idea():
    '''
    Endpoint for adding a new idea.
    '''
    user_id = session.user_id
    userCondition = session.userCondition
    idea_id = 0
    # Get variables from request
    idea = str(request.vars['idea'])
    tags = request.vars['tags[]']
    origin = str(request.vars['origin'])
    sources = request.vars['sources[]']
    dateAdded = datetime.datetime.now()

    if user_id != None:
        # Clean up
        idea = idea.strip()
        tags = tags if isinstance(tags, list) else [tags]
        tags = [str(t) for t in tags]
        if sources:
            sources = sources if isinstance(sources, list) else [sources]
            sources = [int(s) for s in sources]
        
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
        # TODO Update reverse index
        # __update_reverse_index()
        # Log
        __log_action(user_id, "add_idea", idea)
    return json.dumps(dict(id=idea_id))


def get_ideas():
    user_id = session.user_id
    added_by = request.vars.added_by
    print(added_by)
    query = (db.idea.id == db.tag_idea.idea) & (db.tag.id == db.tag_idea.tag)
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
            __run_gsi()            
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
            
def test():
    # Build index of ideas based for each tag
    tags = db(db.tag.id > 0).select()
    for t in tags:
        print(t.tag)
        if ' ' in t.tag: # a change will be necessary
            t.tag = t.tag.replace(' ', '')
            # check if there are duplicates
            conflict = db(db.tag.tag == t.tag).select().first()
            if conflict:
                # there is a conflict. Find all connections that involve the current id
                merge = db(db.tag_idea.tag == t.id).select()
                for m in merge:
                    m.tag = conflict.id
                    m.update_record()
                db(db.tag.id == t.id).delete()
            else:
                # there is no conflict
                t.update_record()

def get_solution_space():
    tags = db((db.tag.id > 0) & (db.tag.replacedBy == None)).select().as_list()
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
    return json.dumps(dict(tags=tags[:SOLUTION_SPACE_MAX_TAGS], connections=connections, max_n=max_n))

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

def get_tags():
    term = '%%%s%%' % (request.vars.term.lower())
    tags = db(db.tag.tag.like(term)).select(db.tag.tag)
    tags = [t.tag for t in tags]
    return json.dumps(tags)

def get_suggested_tags():
    text = request.vars.text
    # Get suggested tags
    tags = __rake(text)
    tags = [__clean_tag(t[0]) for t in tags]
    # Submit response
    response.headers['Content-Type'] = 'text/json'
    return json.dumps(tags)

def tag_exists():
    tag = request.vars.tag
    return str(len(db(db.tag.tag == tag).select()) > 0).lower()











### PRIVATE FUNCTIONS ###
def __run_gsi():
    ''' 
    Runs Chilton et al.'s (2013) adapted Global Structure Inference algorithm.
    Dependencies:
        * __calc_list_similarity(l1, l2)
        * __merge_tags(tags_ideas, tag_i, tag_j)
    '''
    # Build index of ideas based for each tag
    tags_ideas = defaultdict(list)
    results = db((db.tag_idea.id > 0)).select(orderby=db.tag_idea.idea)
    for t in results:
        tags_ideas[t.tag].append(t.idea)
    # Step 1: remove insignificant categories that have fewer than q items
    q = 2
    for (tag, ideas) in tags_ideas.items():
        if len(ideas) < q:
            # delete tag
            db(db.tag.id == tag).delete()
            tags_ideas.pop(tag)
    # Step 2: remove duplicate categories (those that share more than p% of their items).
    # Keep the one that has more items. Break ties randomly.
    p = 0.75 # percent 
    for (tag_i, ideas_i) in tags_ideas.items():
        for (tag_j, ideas_j) in tags_ideas.items():
            if tag_i != tag_j:
                if __calc_list_similarity(ideas_i, ideas_j) >= p:
                    # There is a large overlap. Merge smaller tag into larger
                    chosen_tag = __merge_tags(tags_ideas, tag_i, tag_j)
    # Step 3: Temporarly not implemented (or somewhat implemented in step 2). Paper seemed a bit ambiguous on steps 2 and 3. 
    # Since we don't care too much hierarchies, I'm just using step 2 for now. We may want to revisit this later.
    return json.dumps(tags_ideas)

def __merge_tags(tags_ideas, tag_i, tag_j):
    ''' Merges two tags, both in the dictionary (tags_ideas) as in the db '''
    merged_ideas = list(set(tags_ideas[tag_i] + tags_ideas[tag_j])) # Build the list with all the ideas
    chosen_tag, subsumed_tag = (tag_i, tag_j) if len(tags_ideas[tag_i]) > len(tags_ideas[tag_j]) else (tag_j, tag_i)
    # Update dictionary
    tags_ideas[chosen_tag] = merged_ideas
    tags_ideas.pop(subsumed_tag)
    # Update DB
    # * Add replacedBy field
    subsumed_tag_db = db(db.tag.id == subsumed_tag).select().first()
    subsumed_tag_db.replacedBy = chosen_tag
    subsumed_tag_db.update_record()
    # * replace in join table
    tag_updates = db(db.tag_idea.tag == subsumed_tag).select()
    for t in tag_updates:
        t.tag = chosen_tag
        t.update_record()
    return chosen_tag

def __calc_list_similarity(l1, l2):
    ''' Calculates how much overlap there is between a two lists of ints, regardless of order '''
    total = defaultdict(int)
    count = 0
    for i in l1:
        total[i] += 1
    for i in l2:
        if i in total.keys():
            count += 1
    return count / float(len(total.keys()))

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
    return [dict(id=r.categorization.id,
        type=r.categorization.categorizationType, 
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

# keyword extraction
def __rake(text):
    file = os.path.join(request.folder,'static','SmartStoplist.txt')
    r = rake.Rake(file)
    keywords = r.run(text)
    return keywords

def __update_reverse_index():
    keywords = __rake('A Python module implementation of the Rapid Automatic Keyword Extraction (RAKE) algorithm as described in: Rose, S., Engel, D., Cramer, N., & Cowley, W. (2010). Automatic Keyword Extraction from Individual Documents. In M. W. Berry & J. Kogan (Eds.), Text Mining: Theory and Applications: John Wiley & Sons. Initially by @aneesha, packaged by @tomaspinho')
    return json.dumps(keywords)