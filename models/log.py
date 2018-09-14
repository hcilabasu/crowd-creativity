import datetime
import json
from gluon import current

def log_action(user_id, problem_id, action_name, extra_info=dict()):
    '''
    Inserts a log entry into the DB. Params:
    * user_id: the user's id
    * problem_id: the problem's id
    * action_name: the name of the action
    * extra_info: a dictionary with extra info. Will be stored as a JSON string
    '''
    extra_info = json.dumps(extra_info)
    db.action_log.insert(
        userId=user_id, 
        problem=problem_id,
        dateAdded=datetime.datetime.now(), 
        actionName=action_name, 
        extraInfo=extra_info
    )

current.log_action = log_action