import json
import datetime
from collections import defaultdict
from gluon.debug import dbg

'''
Controller for functions related to the tasks view
'''

def get_available_tasks():
    user_id = session.user_id
    tasks = __get_tasks(user_id)
    # set headers
    response.headers['Content-Type']='application/json'
    return tasks.as_json()

def submit_task():
    user_id = session.user_id
    answer = request.vars['answer']
    task_id = request.vars['id']
    task_type = request.vars['type']
    # Instantiate class
    module = __import__('microtask')
    class_ = getattr(module, task_type)
    task = class_(id=task_id)
    task.complete(user_id, answer)
    return str(task)

def reset_tasks():
    if request.vars['pwd'] == 'blastoise':
        tasks = db(db.task.id > 0).select()
        for t in tasks:
            t.completed = False
            t.completed_by = None
            t.completed_timestamp = None
            t.answer = ''
            t.update_record()


# Private functions
def __get_tasks(user_id):
    problem_id = session.problem_id
    # retrieve tasks already completed
    completed_tag_suggestion = [row.idea for row in db((db.task.completed_by == user_id) & (db.task.task_type == 'TagSuggestionTask') & (db.task.problem == problem_id)).select(db.task.idea)]
    completed_tag_validation = [row.idea for row in db((db.task.completed_by == user_id) & (db.task.task_type == 'TagValidationTask') & (db.task.problem == problem_id)).select(db.task.idea)]
    # retrieve tasks
    tasks = db(
        (db.task.completed == False) & 
        (db.task.owner != user_id) &
        (db.task.idea == db.idea.id) &
        (db.task.problem == problem_id) &
        (((db.task.task_type == 'TagSuggestionTask') &
        ~db.task.idea.belongs(completed_tag_suggestion)) |
        ((db.task.task_type == 'TagValidationTask') &
        ~db.task.idea.belongs(completed_tag_validation)))
    ).select(groupby=db.task.idea)[0:3]
    # Add favorite field
    favorites = __get_favorites(user_id)
    for t in tasks:
        if t.idea.id in favorites:
            t.idea.favorite = True
        else:
            t.idea.favorite = False
    return tasks  #[dict(type="rating", task_id=r.idea_rating.id, idea=r.idea.idea, idea_id=r.idea.id) for r in rating_tasks_results]

# DEPRECATED
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
        log_action(user_id, "upgrade_categorization_Task", json.dumps({'condition':session.userCondition, 'idea_id': idea_id, 'new_type': next_type}))
            


# Private functions

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
        ((db.idea.id == db.tag_idea.idea) & (db.tag.id == db.tag_idea.tag)) & # Link to tags
        ~((db.idea.userId == user_id) & (db.categorization.categorizationType == 'suggest')) & # user has not authored this idea if this is a suggest type
        ~(db.categorization.idea.belongs(completed)) # User has not yet completed it
    ).select(groupby=db.idea.id)
    # get tags for ideas TODO this can probably be optimized into the previous query
    tags_results = db(
        (db.idea.id == 0) &
        (db.idea.id == db.tag_idea.idea) &
        (db.tag.id == db.tag_idea.tag)
    ).select(db.idea.id, db.tag.tag, groupby=db.idea.id)
    print([t for t in tags_results])
    # return results
    return [dict(id=r.categorization.id,
        type=r.categorization.categorizationType, 
        suggested_tags=r.categorization.suggestedTags, 
        chosen_tags=r.categorization.chosenTags,
        task_id=r.categorization.id, 
        idea=r.idea.idea,
        tags=[tag.tag.tag for tag in r.idea.tag_idea.select()],
        idea_id=r.idea.id) for r in tasks_results]

def __get_favorites(user_id):
    favorites_rows = db(db.favorite.user_info == user_id).select(db.favorite.idea)
    return [i.idea for i in favorites_rows]