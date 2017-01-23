# -*- coding: utf-8 -*-
import datetime
import json
import copy
import itertools
from matrix_output import Matrix, Row, Cell

base_query = (db.idea.origin == 'ideation') & (db.idea.pool == False)

# SETTINGS
''' Duration of the blocks. e.g. In a 2 hour brainstorming session, a 30 value will create 4 blocks '''
time_block = 30 
''' 
Size of the overlap. Max number of tag count allowed. e.g. If idea A has tags 1, 2, 3, and 4, a value of 
size_overlap = 2 will increment the number of idea value for tags 1, 2, 3, 4, 1+2, 1+3, 1+4, 2+3, 2+4, 3+4.
'''
size_overlap = 2
'''
Limits how many coincepts are sent over to the front end. Should be limited due to performance issues.
'''
tags_limit = 100

def create_matrix_db():
    ''' 
    When called, this method will recreate the matrix DB based on the contents
    of the ideas, ideas_concept, and concept DBs. 
    '''

    # START ALGORITHM

    # Define number of blocks
    first_idea_time, last_idea_time = __get_first_and_last_times()

    # get ideas
    ideas = __get_ideas_by_time_range(first_idea_time, last_idea_time)
    # extract tags
    i = 0
    for idea in ideas:
        tags = list()
        for concept in idea.idea.concept_idea.select():
            concept = concept.concept.concept.lower()
            tags.append(concept)
        tags.sort()
        # insert into db
        for i in range(1,size_overlap+1):
            for combination in itertools.combinations(tags, i):
                __insert_or_update_matrix(combination, idea, 0, first_idea_time)
                
def index(): 
    ideas = db(base_query).select()
    first_idea = ideas.first()
    last_idea = ideas.last()
    diff = last_idea.dateAdded - first_idea.dateAdded
    range = diff.days * 24 * 60 + diff.seconds / 60 # get the time difference in minutes
    range = range / time_block # number of blocks
    return dict(range=range)

def get_tags_by_minute():
    block = 0 # int(request.vars['minute']) # This will be used when a time range is implemented
    options = request.vars['options[]'] if isinstance(request.vars['options[]'], list) else [request.vars['options[]']]
    if len(options) == 1 and options[0] == None:
        options = []

    # retrieve tags from ideas until the specified minute
    matrix = db(db.concept_matrix.id > 0).select()
    print('Matrix: %d' % len(matrix))
    tags = set()
    for combination in matrix:
        concepts = combination.tags.split(',')
        for c in concepts:
            tags.add(c)
    print('Tags: %d' % len(tags))
    tags = list(tags)
    # Do processing based on options
    processed_tags = copy.copy(tags)
    for option in options:
        processed_tags = __run_method(option, processed_tags)
    print('Processed tags: %d' % len(processed_tags))
    # matrix_output = __build_matrix_output(processed_tags)
    return json.dumps(dict(tags=processed_tags[:tags_limit], len_raw_tags=len(tags), len_processed_tags=len(processed_tags)))

# Processing functions
def first_letter(tags):
    ''' This function shortens tags to their first letter only. For testing purposes '''
    new_tags = set()
    for tag in tags:
        new_tags.add(tag[0])
    return list(new_tags)

def lev_distance(tags):
    return tags

# Private functions
def __build_matrix_output(tags):
    matrix = Matrix()
    for i in range(0, len(tags)+1):
        row = Row()
        for j in range(0, len(tags)+1):
            print('%d - %d' % (i, j))
            cell = Cell(True, '')
            if i != 0 or j != 0:
                is_header = True if i == 0 or j == 0 else False
                value = tags[(i + j)-1] if is_header else 10 # this is supposed to be the count for the intersection
                cell = Cell(is_header, value)
            row.add_cell(cell)
        matrix.add_row(row)
    return str(matrix)

def __run_method(method_name, tags):
    print('Trying to run method %s' % method_name)
    possibles = globals().copy()
    possibles.update(locals())
    method = possibles.get(method_name)
    return method(tags)

def __get_first_and_last_times():
    ideas = db(base_query).select()
    first_idea = ideas.first()
    last_idea = ideas.last()
    return (first_idea.dateAdded, last_idea.dateAdded)

def __get_ideas_by_time_limit(time_limit):
    return db(base_query &
        (db.idea.dateAdded <= time_limit) &
        ((db.idea.id == db.concept_idea.idea) & 
        (db.concept.id == db.concept_idea.concept))
    ).select(orderby=~db.idea.id, groupby=db.idea.id)

def __get_ideas_by_time_range(lower_limit, upper_limit):
    return db(base_query &
        (db.idea.dateAdded >= lower_limit) &
        (db.idea.dateAdded <= upper_limit) &
        ((db.idea.id == db.concept_idea.idea) & 
        (db.concept.id == db.concept_idea.concept))
    ).select(orderby=~db.idea.id, groupby=db.idea.id)

def __insert_or_update_matrix(tags, idea, current_block, current_block_time):
    tags_string = ','.join(tags)
    result = db((db.concept_matrix.tags == tags_string) & (db.concept_matrix.time_unit == current_block)).select().first()
    if result:
        result.ideas += 1
        result.update_record()
    else:
        db.concept_matrix.insert(tags=tags_string, ideas=1, time_unit=current_block, start_time=current_block_time)