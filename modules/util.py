from gluon import current
from random import SystemRandom

# PROBLEM INFORMATION

def get_problem_title(request):
    return request.args(0)

def get_problem_id(request):
    title = get_problem_title(request)
    db = current.db
    id = db(db.problem.url_id == title).select().first().id
    return id

# CONDITIONS

def get_available_conditions():
    db = current.db
    available_conditions = db(db.sessionCondition.conditionCount == 0).select()
    if len(available_conditions) == 0:
        # There are no conditions available. Reset them and try again
        reset_conditions()
        available_conditions = db(db.sessionCondition.conditionCount == 0).select()
    # Randomly choose one
    chosen = SystemRandom().choice(available_conditions)
    # Update condition in DB
    increment_condition(chosen)
    return chosen

def reset_conditions():
    db = current.db
    conditions = db(db.sessionCondition.id > 0).select()
    # Reset all conditions
    for c in conditions:
        c.conditionCount = 0
        c.update_record()

def increment_condition(condition):
    condition.conditionCount += 1
    condition.update_record()
    