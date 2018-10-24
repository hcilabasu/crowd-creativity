import json
import datetime
import util
import user_models
import random
from collections import defaultdict
from gluon.debug import dbg

'''
Controller for functions related to the tasks view
'''

NUM_TASKS = 3


def get_available_tasks():
    user_id = session.user_id
    problem_id = util.get_problem_id(request)
    tasks = __get_tasks(user_id, problem_id)
    # set headers
    response.headers['Content-Type']='application/json'
    # encode json
    tasks = [json.loads(t.as_json()) for t in tasks]
    random.shuffle(tasks)
    # Log
    log_action(user_id, problem_id, 'get_available_tasks', {'num_tasks': len(tasks), 'tasks': tasks})
    return json.dumps(tasks)

def submit_task():
    user_id = session.user_id
    problem_id = util.get_problem_id(request)
    answer = request.vars['answer']
    task_id = request.vars['id']
    task_type = request.vars['type']
    last = True if request.vars['last'] else False
    # Instantiate class
    module = __import__('microtask')
    class_ = getattr(module, task_type)
    task = class_(id=task_id, problem=problem_id)
    task.complete(user_id, answer)
    # Log
    log_action(user_id, problem_id, 'submit_task', {'task_type': task_type, 'answer': answer})
    return json.dumps(dict(last=True))

def reset_tasks():
    if request.vars['pwd'] == 'blastoise':
        tasks = db(db.task.id > 0).select()
        for t in tasks:
            t.completed = False
            t.completed_by = None
            t.completed_timestamp = None
            t.answer = ''
            t.update_record()

def add_one_task():
    ''' 
    Adds one duplicate for every pool == True task in the problem passed in the request 
    ONLY WORKS FOR RATING TASK AT THE MOMENT
    '''
    microtask = __import__('microtask')
    problem = request.vars['problem']
    if not problem:
        return 'Must pass a problem'
    tasks = db((db.task.problem == problem) & (db.task.task_type == 'RatingTask') & (db.task.pool == True)).select(groupby=db.task.idea)
    for t in tasks:
        microtask.RatingTask(idea=t.idea, problem=t.problem, pool=True)
    return 'Added %d tasks!' % len(tasks)

# Private functions
def __get_tasks(user_id, problem_id):
    # Get tags
    model = user_models.UserModel(user_id, problem_id)
    inspiration_categories, all_inferred = model.get_inspiration_categories(NUM_TASKS)
    # Remove duplicates
    inspiration_categories = list(set(inspiration_categories))
    inspiration_categories.extend(all_inferred)
    
    # Get idea ids that the user already has used as inspiration
    completed_tasks = db(
        (db.task.completed_by == user_id) & 
        (db.task.task_type == 'RatingTask') & 
        (db.task.problem == problem_id)).select(db.task.idea)
    completed_tasks = [row.idea for row in completed_tasks]
    
    if len(inspiration_categories) < NUM_TASKS:
        # there were not enough inspiration categories. Randomily add more
        tags = [t.tag for t in db(db.tag.problem == problem_id).select(orderby='<random>')]
        inspiration_categories.extend(tags)

    tasks = []
    for t in inspiration_categories:
        try:
            # Get tag id
            t_id = db((db.tag.problem == problem_id) & (db.tag.tag == t)).select(db.tag.id).first().id
            # Get an idea id
            if t_id:
                idea_id = db(
                    (db.tag_idea.tag == t_id) & 
                    (~db.tag_idea.idea.belongs(completed_tasks)) &
                    (db.tag_idea.idea == db.idea.id) &
                    (db.idea.pool == True)).select(db.tag_idea.idea, orderby='<random>').first().idea
                if idea_id:
                    # Get a task for this idea and add it to list
                    task = db(
                        (db.task.idea == idea_id) &
                        (db.task.idea == db.idea.id) &
                        (db.task.idea == db.tag_idea.idea) &
                        (db.tag_idea.tag == db.tag.id)).select().first()
                    if task:
                        tasks.append(task)
        except Exception:
            pass
        if len(tasks) == NUM_TASKS:
            break

    # Add favorites
    favorites = __get_favorites(user_id)
    for t in tasks:
        if t.idea.id in favorites:
            t.idea.favorite = True
        else:
            t.idea.favorite = False

    # Filter to max number of tasks and return
    return tasks

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