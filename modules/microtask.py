import datetime
import json
from gluon import current

# Classes
class Task:
    def __init__(self, id=None, idea=None, tags=[], task=None, options=None):
        # Get the db object
        db = current.db
        # Set parameters
        self.id = id 
        self.idea = idea
        self.tags = tags
        self.task = task
        self.options = options
        if id: # If the task id was provided, load it
            # TODO implement lazy loading
            # TODO throw error if task not found
            self.task = current.db(db.task.id == id).select().first()
            self.id = self.task.id
            self.idea = self.task.idea
            self.options = self.task.options
        elif self.idea: # If the idea id was provided, add a new task
            # Get idea owner
            owner_id = db(db.idea.id == idea).select(db.idea.userId).first().userId
            # Add it
            self.id = db.task.insert(
                task_type=self.task_type(),
                idea=idea,
                tags=tags,
                owner=owner_id,
                options=options)

    def __str__(self):
        out = 'Task: %s\n' % str(self.task_type())
        out += '- Idea:          %s\n' % str(self.task.idea)
        out += '- Tags:          %s\n' % str(self.task.tags)
        out += '- Completed:     %s\n' % str(self.task.completed)
        out += '- Completed_by:  %s\n' % str(self.task.completed_by)
        out += '- Completed_ts:  %s\n' % str(self.task.completed_timestamp)
        out += '- Answer:        %s\n' % str(self.task.answer)
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
        print('microtask complete...')
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
            (db.task.idea == self.idea) &
            (db.task.completed == False)).select()
        return len(results) == 0

    # Abstract methods--must be implemented by subclasses
    def next_step(self): print('Run generic next_step...')

class TagSuggestionTask(Task):
    # How many tasks are added
    COUNT=2
    # Processes the next step
    def next_step(self):
        '''
        The TagSuggestionTask is the first type of categorization task in the pipeline.
        When it's complete, deploy the validation tasks.
        '''
        print('Run TagSuggestionTask next_step()')
        if self.is_completed():
            db = current.db
            # Get options from all tasks
            tasks = db((db.task.task_type == self.task_type()) & (db.task.idea == self.task.idea)).select(db.task.answer)
            answers = set()
            for t in tasks:
                answer = json.loads(t.answer)
                print('Answer: ' + str(answer))
                answers |= set(answer)
            print('Answers: ' + str(json.dumps(list(answers))))
            # Deploy the TagValidationTask
            for i in range(0,TagValidationTask.COUNT):
                print('creating tagvalidationtasks... ' + str(i))
                TagValidationTask(idea=self.task.idea, options=json.dumps(list(answers)))

class TagValidationTask(Task):
    # How many tasks are added
    COUNT=2
    # Processes the next step
    def next_step(self):
        print('Next step Category VALIDATION Task')

class TagMergeTask(Task):
    def next_step(self):
        print('Next step Category MERGE Task')
