import datetime
import json
from gluon import current

'''
This class is the backbone of the microtask model.

ADDING A NEW TYPE OF MICROTASK
If you want to add a new task type, follow the following steps:

1. Add a new child class of task on this file (e.g. class RatingTask(Task): ...)
2. Implement the next_step method according to the logic required when all tasks of this type are completed
3. Make sure tasks of this type are inserted, probably when a new idea is added (default.py > __insert_tasks_for_idea())
4. Make sure the MustacheTemplate is defined (at this moment they're defined on index.html) with the name RatingTaskTemplate
5. Add a property with the name of task type (e.g. RatingTask) to the taskTypeProcessor function on system.js and implement the submission logic
'''

# Classes
class Task:
    def __init__(self, id=None, idea=None, tags=[], task=None, options=None, problem=None, pool=True):
        # Get the db object
        db = current.db
        # Set parameters
        self.id = id 
        self.idea = idea
        self.tags = tags
        self.task = task
        self.options = options
        self.problem = problem
        self.pool = pool
        if id: # If the task id was provided, load it
            # TODO implement lazy loading
            # TODO throw error if task not found
            self.task = current.db(db.task.id == id).select().first()
            self.id = self.task.id
            self.idea = self.task.idea
            self.options = self.task.options
            self.pool = self.task.pool
        elif self.idea: # If the idea id was provided, add a new task
            # Get idea owner
            owner_id = db(db.idea.id == idea).select(db.idea.userId).first().userId
            # Add it
            self.id = db.task.insert(
                task_type=self.task_type(),
                idea=idea,
                tags=tags,
                problem=problem,
                owner=owner_id,
                pool=pool,
                options=options)

    def __str__(self):
        out = 'Task: %s\n' % str(self.task_type())
        out += '- Idea:          %s\n' % str(self.task.idea)
        out += '- Tags:          %s\n' % str(self.task.tags)
        out += '- Completed:     %s\n' % str(self.task.completed)
        out += '- Completed_by:  %s\n' % str(self.task.completed_by)
        out += '- Completed_ts:  %s\n' % str(self.task.completed_timestamp)
        out += '- Answer:        %s\n' % str(self.task.answer)
        out += '- Pool:        %s\n' % str(self.task.pool)
        return out

    def task_type(self):
        ''' Returns the name of the task type '''
        name = str(self.__class__)
        name = name.split('.') # split class name
        name = name[len(name)-1] # get the last part
        return name

    def update(self):
        ''' Update self.task on the db '''
        self.task.update_record()

    def complete(self, user_id, answer):
        ''' Completes a task based  '''
        # Complete on database
        self.task.completed = True
        self.task.completed_by = user_id # TODO throw exception if user_id == None
        self.task.completed_timestamp = datetime.datetime.now()
        self.task.answer = answer
        self.update()
        # Trigger validation and next steps
        self.next_step()

    def is_completed(self):
        ''' 
        Checks if there are any tasks of this type/idea that are still yet to be completed
        Returns: True if there are pending tasks, False if all tasks are done.
        '''
        # TODO throw exception when idea == None
        db = current.db
        results = db(
            (db.task.task_type == self.task_type()) & 
            (db.problem == self.problem) &
            (db.task.idea == self.idea) &
            (db.task.completed == False)).select()
        return len(results) == 0

    # Abstract methods--must be implemented by subclasses
    # This method is called whenever all added tasks of a given type are completed
    def next_step(self): 
        pass

class TagSuggestionTask(Task):
    # How many tasks are added
    COUNT=2
    # Processes the next step
    def next_step(self):
        '''
        The TagSuggestionTask is the first type of categorization task in the pipeline.
        When it's complete, deploy the validation tasks.
        '''
        if self.is_completed():
            db = current.db
            # Get options from all tasks
            tasks = db((db.task.task_type == self.task_type()) & (db.task.idea == self.task.idea) & (db.task.problem == self.problem)).select(db.task.answer)
            answers = set()
            for t in tasks:
                answer = json.loads(t.answer)
                answers |= set(answer)
            # Deploy the TagValidationTask
            for i in range(0,TagValidationTask.COUNT):
                TagValidationTask(idea=self.task.idea, options=json.dumps(list(answers)))

class TagValidationTask(Task):
    def next_step(self):
        pass

class TagMergeTask(Task):
    def next_step(self):
        pass

class RatingTask(Task):
    def next_step(self): # add more tasks when all current ones are completed
        RatingTask(idea=self.task.idea, problem=self.problem, pool=True)
        
