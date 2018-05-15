import json
import datetime
from collections import defaultdict
from gluon.debug import dbg
import user_models

'''
Controller for functions related to the tasks view
'''

NUM_TASKS = 3


def get_available_tasks():
    user_id = session.user_id
    problem_id = session.problem_id
    tasks = __get_tasks(user_id, problem_id)
    # set headers
    response.headers['Content-Type']='application/json'
    # encode json
    tasks = [json.loads(t.as_json()) for t in tasks]
    return json.dumps(tasks)

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
def __get_tasks(user_id, problem_id):
    # Get tags
    model = user_models.UserModel(user_id, problem_id)
    inspiration_categories = model.get_inspiration_categories(NUM_TASKS)

    print(inspiration_categories)
    # These are the task types that will be retrieved
    task_types = [
        # 'TagSuggestionTask',
        # 'TagValidationTask',
        'RatingTask'
    ]
    
    # Build query
    completed_tasks = dict()
    # For each tasktype, retrieve the idea id for tasks already completed by the current user and build query to avoid them
    completed_query = None # Holds the query to avoid all repeated tasks
    retrieve_tasks = lambda task_type: [row.idea for row in db((db.task.completed_by == user_id) & (db.task.task_type == task_type) & (db.task.problem == problem_id)).select(db.task.idea)]
    for t in task_types:
        completed_tasks[t] = retrieve_tasks(t) # retrieve completed tasks for type t
        query = ((db.task.task_type == t) & ~db.task.idea.belongs(completed_tasks[t])) # build query to ignore completed tasks
        completed_query = (completed_query) | query if completed_query != None else query # append to completed query
    
    # all_query holds the query to retrieve all non-completed tasks that do not belong to the current user
    all_query = ((db.task.completed == False) & 
        (db.task.owner != user_id) & 
        (db.task.idea == db.idea.id) &
        (db.task.problem == problem_id) &
        ((db.task.idea == db.tag_idea.idea) &
        (db.tag_idea.tag == db.tag.id)))
    # Retrieve all tasks except: owned by user, completed by user, type not in task_types
    # This will have duplicates if an idea has more than one tag. One row for each tag.
    # IMPORTANT: this will probably break when more task types are used. Maybe do one query per task_type.
    tasks = db(all_query).select(groupby=db.tag_idea.id, having=completed_query, orderby='<random>')
    
    # Filter based on recommended categories
    # TODO just randomly select if this is not the explicit intervention condition or if there are no inspiraiton categories
    if len(inspiration_categories) > 0:
        tasks.exclude(lambda row: row.tag.tag not in inspiration_categories)
    # At this point, all tasks belong to the inspiration categories, 
    # but we need to sample one from each of the categories.
    filtered_tasks = []
    for t in tasks:
        if t.tag.tag in inspiration_categories:
            filtered_tasks.append(t)
            inspiration_categories.remove(t.tag.tag)

    # Add favorites
    favorites = __get_favorites(user_id)
    for t in filtered_tasks:
        if t.idea.id in favorites:
            t.idea.favorite = True
        else:
            t.idea.favorite = False

    # Filter to max number of tasks and return
    return filtered_tasks

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

def __get_favorites(user_id):
    favorites_rows = db(db.favorite.user_info == user_id).select(db.favorite.idea)
    return [i.idea for i in favorites_rows]