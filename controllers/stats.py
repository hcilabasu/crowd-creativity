# -*- coding: utf-8 -*-

import user_models
import collab_filter
import json
import datetime
import cStringIO
import csv
import numpy
import re
import unicodedata
from collections import defaultdict

CONDITIONS = dict(control=1,subtle=2,overt=3,all=4)
SESSION_DURATION = 15 # IN MINUTES

def index():
    __check_auth()
    problems = db(db.problem.id > 0).select()
    users_per_problem = dict()
    regenerated = True if request.vars.regenerated else False
    for p in problems:
        users_per_problem[p.id] = __get_users_in_problem(p.id)
    return dict(problems=problems, users_per_problem=users_per_problem, regenerated=regenerated)

def stats_login():
    return dict()

def reset_conditions():
    __check_auth()
    conditions = db(db.sessionCondition.id > 0).select()
    # clear all conditions
    db(db.sessionCondition.id > 0).delete()
    # Insert the correct ones
    for k,v in CONDITIONS.items():
        db.sessionCondition.insert(
            conditionNumber=v,
            conditionName=k,
            conditionCount=0
        )
    redirect(URL('stats', 'index'))

def log_out():
    session.stats_login = False
    redirect(URL('stats', 'index'))

def usermodel():
    __check_auth()
    user_id = request.vars['user']
    problem_id = request.vars['problem']
    if not user_id or not problem_id:
        redirect(URL('stats', 'index'))
    # retrieve contextual info
    user = db(db.user_info.id == user_id).select().first()
    problem = db(db.problem.id == problem_id).select().first()
    if not user or not problem:
        redirect(URL('stats', 'index'))
    # Retrieve user model
    user_model = user_models.UserModel(user.id, problem.id)
    # Get all user models in problem_id
    all_users = __get_users_in_problem(problem_id, [user_id])
    models = []
    for u in all_users:
        models.append(user_models.UserModel(u.idea.userId, problem_id))
    nearest_neighbors = collab_filter.find_n_nearest(user_model, models, 5, db)
    # Infer categories from nearest neighbors
    inferred = collab_filter.infer_categories(user_model, nearest_neighbors, True)
    # Get logs
    logs = db((db.action_log.problem == problem_id) & (db.action_log.userId == user_id)).select()
    return dict(
        user=user, 
        problem=problem, 
        model=user_model, 
        nearest_neighbors=nearest_neighbors, 
        inferred=inferred,
        inferred_json=json.dumps(inferred),
        logs=logs,
        adjacent=', '.join(__handle_unicode(user_model.transition_graph.get_adjacent(user_model.last_cat))),
        inspiration_cats=', '.join(__handle_unicode(user_model.get_inspiration_categories(3))),
        ordered_tags=', '.join(__handle_unicode(user_model.get_ordered_tags())))

def __handle_unicode(l):
    new = []
    for v in l:
        try:
            u_c = unicode(v)
            u_c = unicodedata.normalize('NFKD', u_c).encode('ascii','ignore')
            new.append(str(u_c))
        except Exception:
            new.append(str(v))
    return new

def organize_tags():
    __check_auth()
    problem_id = long(request.vars['problem'])
    problem = db(db.problem.id == problem_id).select().first()
    tags = db(db.tag.problem == problem_id).select(orderby=db.tag.replacedBy)
    # Get counts for each tag and create structure
    counts = defaultdict(int)
    structure = dict()
    for t in tags:
        # Get counts
        counts[t.id] = db((db.tag_idea.tag == t.id) | (db.tag_idea.replaced_tag == t.id)).count()
        # Add to structure
        tag = dict(id=t.id, tag=t.tag, children=[])
        if not t.replacedBy:
            structure[t.id] = tag
        else:
            structure[t.replacedBy]['children'].append(tag)
    tags = sorted([v for k,v in structure.items()], key=lambda tag : tag['tag'])
    return dict(problem=problem, tags=tags, counts=counts)

def get_ideas_by_tag():
    tag_id = long(request.vars['id'])
    ideas = db((db.tag_idea.tag == tag_id) &
        (db.idea.id == db.tag_idea.idea)).select()
    return ideas.as_json()

def update_tags():
    __check_auth()
    problem_id = long(request.vars['problem'])
    tags = json.loads(request.vars['tags'])
    for t in tags:
        if 'tag' in t:
            tag = t['tag']
            parent = t['parent'] if 'parent' in t else None
            # Get tag from DB
            db_tag = db(db.tag.id == tag).select().first()
            if 'parent' in t:
                # Tag is demoted. Now we check to see if it has the right parent.
                # If it does, do nothing. If it doesn't, replace the parent.
                if db_tag.replacedBy != parent:
                    # Tag is demoted but has the wrong parent. Update in DB
                    __change_parent(db_tag, parent)
            else:
                # Tag
                if db_tag.replacedBy != None:
                    # Tag was demoted in DB, but not anymore. Promote it. 
                    __change_parent(db_tag, None)
    # Regenerate models
    __regenerate_models()
    # Redirect back
    url = 'organize_tags?problem=%d' % problem_id
    redirect(URL('stats', url))

def __change_parent(db_tag, parent_id):
    has_parent = db_tag.replacedBy != None
    ''' Changes the parent of the tag in the DB. If parent_id == None, removes parent'''
    # Change actual tag
    db_tag.replacedBy = parent_id
    db_tag.update_record()
    # Change tag in tag_idea table
    query = (db.tag_idea.replaced_tag == db_tag.id) if has_parent else ((db.tag_idea.tag == db_tag.id) & (db.tag_idea.replaced_tag == None))
    tag_ideas = db(query).select()
    for t in tag_ideas:
        if parent_id == None:
            # Reset tag to no parent
            t.tag = t.replaced_tag
            t.replaced_tag = None
        else:
            # Add parent
            t.tag = parent_id
            t.replaced_tag = db_tag.id
        t.update_record()

def regenerate_models():
    __check_auth()
    # Delete all models
    __regenerate_models()
    # Send back to stats
    redirect(URL('stats','index'))

def download_data():
    __check_auth()
    problem_id = long(request.vars['problem'])
    users = __get_users_in_problem(problem_id)
    # Get data
    fields, records = __get_data(problem_id)
    filename = 'user_data_%d_%s.csv' % (problem_id, datetime.date.today())
    return __prepare_csv_response(fields, records, filename, problem_id)

def download_logs():
    __check_auth()
    problem_id = long(request.vars['problem'])
    users = __get_users_in_problem(problem_id)
    users_ids = [u.idea.userId for u in users]
    # Get data
    fields = [
        'actionName',
        'userId', 
        'problem',
        'extraInfo',
        'dateAdded'
    ]
    rows = db(db.action_log.problem == problem_id).select()
    records = []
    for r in rows:
        if(r.userId in users_ids):
            records.append([
                r.actionName,
                r.userId,
                r.problem,
                r.extraInfo,
                r.dateAdded
            ])
    filename = 'logs_%d_%s.csv' % (problem_id, datetime.date.today())
    return __prepare_csv_response(fields, records, filename, problem_id)

def download_ideas():
    __check_auth()
    problem_id = long(request.vars['problem'])
    fields = [
        'user',
        'condition',
        'id',
        'idea',
        'timestamp',
        'origin',
        'sources',
        'tags'
    ]
    # Get records
    rows = db(db.idea.problem == problem_id).select()
    records = []
    for r in rows:
        model = user_models.UserModel(r.userId, problem_id)
        tags = db((db.tag_idea.idea == r.id) & (db.tag.id == db.tag_idea.tag)).select()
        tags = [t.tag.tag for t in tags]
        records.append([
            r.userId,
            model.user_condition, # condition
            r.id,
            r.idea,
            r.dateAdded,
            r.origin,
            r.sources,
            '|'.join(tags) # tags 
        ])
    # Return
    filename = 'ideas_%d_%s.csv' % (problem_id, datetime.date.today())
    return __prepare_csv_response(fields, records, filename, problem_id)

def download_events():
    __check_auth()
    problem_id = long(request.vars['problem'])
    fields = [
        'condition',
        'user',
        'event',
        'time_delta', # time, in seconds, from wich the event happened 
        'seconds', # time, in seconds, from wich the event happened
        'extra_info', # e.g. the actual idea
        'breadth' # total breadh up to this event
    ]
    users = __get_users_in_problem(problem_id)
    records = []
    for u in users:
        user = db(db.user_info.id == u.idea.userId).select().first()
        model = db((db.user_model.user == user.id) & (db.user_model.problem == problem_id)).select().first()
        condition = model.user_condition
        events = __get_events_per_user(user, problem_id, condition)
        records.extend(events)
    # Prepare response
    filename = 'events_%d_%s.csv' % (problem_id, datetime.date.today())
    return __prepare_csv_response(fields, records, filename, problem_id)

def __regenerate_models():
    users = db(db.user_model.id > 0).select()
    for u in users:
        u.last_cat = None
        u.count_pair = 0
        u.count_transition_pairs = 0
        u.transition_graph = '[]'
        u.category_matrix = '{}'
        u.update_record()
    # Get all ideas
    ideas = db(db.idea.id > 0).select()
    # For each idea, get tags and update model
    for i in ideas:
        # Get tags
        tags = db((db.tag_idea.idea == i.id) & (db.tag.id == db.tag_idea.tag)).select(db.tag.tag, groupby=db.tag_idea.id)
        tags = [t.tag for t in tags]
        # Get contextual info
        problem_id = i.problem
        user_id = i.userId
        # Get model and update it
        model = user_models.UserModel(user_id, problem_id)
        model.update(tags)

def __prepare_csv_response(fields, records, filename, problem_id):
    # Create file
    file = cStringIO.StringIO()
    csv_file = csv.writer(file)
    # Write header row
    csv_file.writerow(fields)
    # Write fields
    for r in records:
        updated_row = []
        for c in r:
            try:
                u_c = unicode(c)
                u_c = str(unicodedata.normalize('NFKD', u_c).encode('ascii','ignore'))
                updated_row.append(u_c)
            except Exception:
                updated_row.append(str(c))
        csv_file.writerow(updated_row)
    # Prepare response
    response.headers['Content-Type']='application/vnd.ms-excel'
    response.headers['Content-Disposition']='attachment; filename=%s' % filename
    return file.getvalue()

def __get_data(problem_id):
    users = __get_users_in_problem(problem_id)
    # Define fields
    fields = [
        'problem_id',
        'user_id',
        'public_id',
        'initial_login',
        'condition',
        'num_ideas',
        'num_refined',
        'num_combined',
        'num_inspirations',
        'num_clicks_sp',
        'breadth',
        'depth_avg',
        'depth_max',
        'breadth_1',
        'breadth_2',
        'avg_click_i',
        'sp_fulfill',
        'insp_fulfill',
        'category_switch_ratio',
        'model_url',
        ]
    # TODO get data
    records = []
    for u in users:
        user = db(db.user_info.id == u.idea.userId).select().first()
        public_id = user.userId
        initial_login = user.initialLogin
        model = user_models.UserModel(u.idea.userId, problem_id)
        # Get the number of inspiration requests
        num_inspirations = db(
            (db.action_log.problem == problem_id) & 
            (db.action_log.userId == u.idea.userId) &
            (db.action_log.actionName == 'get_available_tasks')).count()
        
        # Get the number of clicks on a solution space cell
        num_clicks_sp = db(
            (db.action_log.problem == problem_id) & 
            (db.action_log.userId == u.idea.userId) &
            (db.action_log.actionName == 'get_ideas')).select().find(lambda r : 'tags' in r.extraInfo)

        # Get the number of refined and combined ideas
        refined = db(
            (db.idea.problem == problem_id) & 
            (db.idea.userId == u.idea.userId) &
            (db.idea.origin == 'refinement')).count()
        combined = db(
            (db.idea.problem == problem_id) & 
            (db.idea.userId == u.idea.userId) &
            (db.idea.origin == 'combine')).count()
            
        breadth_1, breadth_2 = __get_breadth_per_half(user, problem_id)

        # Get fulfillment and related metrics
        fulfill = __get_fulfillment_metrics(user, problem_id)

        # Create record
        user_record = [
            problem_id,
            u.idea.userId,
            public_id,
            initial_login,
            model.user_condition,
            model.get_num_ideas(),
            refined,
            combined,
            num_inspirations,
            len(num_clicks_sp),
            model.get_breadth(),
            model.get_depth_avg(),
            model.get_depth_max(),
            breadth_1, 
            breadth_2, 
            fulfill['avg_click_i'],
            fulfill['sp_fulfill'],
            fulfill['insp_fulfill'],
            model.category_switch_ratio,
            'http://' + request.env.http_host + URL('stats','usermodel?problem=%d&user=%d' % (problem_id, u.idea.userId)),
        ]
        # Add to array
        records.append(user_record)

    return fields, records

def __get_fulfillment_metrics(user, problem_id):
    avg_click_i = []
    ss_fulfill = []
    insp_fulfill = []
    last_ss_cats = []
    last_insp_cats = []
    last_tags_cats = [] # Last tags viewd by the user in the ss
    # Get user logs that we're interested in
    logs = db((db.action_log.userId == user.id) & (db.action_log.problem == problem_id)).select()
    for l in logs:
        extra_info = json.loads(l.extraInfo)
        if l.actionName == 'get_available_tasks':
            pass
            # # Update insp info
            # tags = []
            # for task in extra_info['tasks']:
            #     tags.append(task['tag']['tag'])
            # last_insp_cats = __update_tags(tags, problem_id)
            # insp_fulfill.append(0)
        elif l.actionName == 'get_ordered_tags':
            # get last ss order
            tags = extra_info['tags']
            last_ss_cats = __exclude_nonpool_tags(tags, problem_id, user)
        elif l.actionName == 'get_ideas' and '"tags":' in l.extraInfo:
            tags = extra_info['tags'], problem_id
            # Update ss info
            last_tags_cats = tags
            ss_fulfill.append(0)
            # Update click information
            # Get the index of the click
            for t in tags:
                if t in last_ss_cats:
                    avg_click_i.append(last_ss_cats.index(t))
        elif l.actionName == 'add_idea':
            # Check against last
            tags = extra_info['tags'], problem_id
            for t in tags:
                if t in last_tags_cats: # if this tag is in the last ss tags
                    ss_fulfill[len(ss_fulfill)-1] += 1
                # if t in last_insp_cats: # if this tag is in the last insp tags
                #     insp_fulfill[len(insp_fulfill)-1] += 1

    # Prepare return dictionary
    fulfill = dict()
    fulfill['avg_click_i'] = numpy.average(avg_click_i)
    fulfill['sp_fulfill'] = numpy.average(ss_fulfill)
    fulfill['insp_fulfill'] = numpy.average(insp_fulfill)
    return fulfill

def __get_events_per_user(user, problem_id, condition):
    ''' Generate a list of events with timestamps based on the initial login time '''
    half_time = (SESSION_DURATION / 2) * 60 # Half time threshold in seconds (i.e. any idea after this threshold from the start_time is considered 2nd half)
    # Get starting time
    start_time = user.initialLogin
    # Get all ideas
    logs = db((db.action_log.userId == user.id) & (db.action_log.problem == problem_id)).select()
    events = []
    breadth = set()
    for l in logs:
        time = l.dateAdded
        time_delta = (time - start_time)#.total_seconds()
        action_name = l.actionName
        extra_info = ''
        inspiration_tags = None
        if action_name == 'get_ideas' and 'tags' in l.extraInfo:
            # This was a click in the solution_space
            action_name = 'click_sp'
        elif action_name == 'add_idea':
            tags = __update_tags(json.loads(l.extraInfo)['tags'], problem_id)
            breadth.update(tags)
            idea = json.loads(l.extraInfo)
            extra_info = json.dumps({'idea':idea['idea'], 'id':idea['id']})
        elif action_name == 'get_inspiration_categories':
            inspiration_tags = json.loads(l.extraInfo)['tags']
            extra_info = json.dumps(inspiration_tags)
        elif action_name == 'get_available_tasks':
            # TODO Order by inspiration_tags
            # Clean out tags
            ideas = [{'idea':t['idea']['idea'], 'idea_id':t['idea']['id'], 'tag':t['tag']['tag']} for t in json.loads(l.extraInfo)['tasks']]
            extra_info = json.dumps(ideas)
        event = [
            condition,
            user.id,
            action_name,
            time,
            time_delta,
            extra_info,
            len(breadth)
        ]
        events.append(event)
    return events

def __get_breadth_per_half(user, problem_id):
    ''' Gets measures of breadth separately for first and second half for a given user '''
    breadth_1 = set()
    breadth_2 = set()
    half_time = (SESSION_DURATION / 2) * 60 # Half time threshold in seconds (i.e. any idea after this threshold from the start_time is considered 2nd half)
    # Get starting time
    start_time = user.initialLogin
    # Get all ideas
    ideas_added = db((db.action_log.userId == user.id) & (db.action_log.problem == problem_id) & (db.action_log.actionName == 'add_idea')).select()
    for i in ideas_added:
        time = i.dateAdded
        tags = __update_tags(json.loads(i.extraInfo)['tags'], problem_id)
        time_delta = (time - start_time).total_seconds()
        if time_delta > half_time: # Check if the time difference is greater than threshold
            breadth_2.update(tags) # it is greater. Idea belongs to second half.
        else:
            breadth_1.update(tags) # It is not. Belongs in first half.
    return len(breadth_1), len(breadth_2)

def __exclude_nonpool_tags(tags, problem_id, user):
    '''
    Goes over a list of tags and removes any tags that should not be visible to a given user
    i.e. excludes non-pool ideas' tags (by users other than user)
    '''
    # Get all tags
    # This is highly inneficient :(
    all_tags_ids = db(
        (db.tag_idea.idea == db.idea.id) & 
        (db.idea.problem == problem_id) &
        ((db.idea.pool == True) | (db.idea.userId == user.id))
    ).select(db.tag_idea.tag)
    all_tags_ids = [t.tag for t in all_tags_ids]
    all_tags = db(db.tag.id.belongs(all_tags_ids)).select()
    all_tags = [t.tag for t in all_tags]
    # Exclude
    final_tags = []
    for t in tags:
        if t in all_tags:
            final_tags.append(t)
    return final_tags

def __update_tags(tags, problem_id):
    ''' 
    This function checks if a list of tags has been update (through the tag manager). 
    Returns a list of tags with the most up to date version.
    '''
    updated = []
    for t in tags:
        updated_tag = db((db.tag.tag == t) & (db.tag.problem == problem_id) & (db.tag.replacedBy != None)).select().first()
        if updated_tag:
            # Tag has been updated. Get the replacement.
            replacement = db(db.tag.id == updated_tag.replacedBy).select().first().tag
            if replacement not in updated: # Prevent duplicates
                updated.append(replacement)
        else:
            # Tag is not updated
            if t not in updated: # Prevent duplicates
                updated.append(t)
    return updated

def __get_users_in_problem(problem_id, blacklist=[]):
    '''
    Returns a list of all users who contributed in a problem.
    blacklist: list of ids of users to be excluded from this list
    '''
    return db(
        (db.idea.problem == problem_id) & 
        (db.idea.userId == db.user_info.id) &
        (~db.idea.userId.belongs(blacklist))
    ).select(db.idea.userId, db.user_info.userId, db.user_info.initialLogin, distinct=True)

def __check_auth():
    pwd = request.vars['pwd']
    if not (session.stats_login or pwd == STATS_PWD): # if not logged in or password not the correct
        redirect(URL('stats','stats_login'))
    else:
        session.stats_login = True
