import json
import datetime
import util

'''
Controller for functions realted to idea workspace view
'''

def get_ideas():
    user_id = session.user_id
    problem_id = util.get_problem_id(request)
    current_only = True if request.vars.current_only == 'true' else False
    added_by = request.vars.added_by
    is_favorite = request.vars.is_favorite
    strict = True if request.vars.strict == 'true' else False
    tags = None
    if request.vars['tags[]']:
        tags = request.vars['tags[]'] if isinstance(request.vars['tags[]'], list) else [request.vars['tags[]']] 
    favorites = __get_favorites(user_id)
    log_info = dict()

    # Build query
    query = (db.idea.id == db.tag_idea.idea) & \
        (db.tag.id == db.tag_idea.tag) & \
        (db.idea.problem == problem_id)
    if current_only:
        log_info['current_only'] = True
        query = query & (db.idea.replacedBy == None)
    if added_by:
        log_info['added_by'] = user_id
        query = query & (db.idea.userId == user_id)
    if is_favorite:
        log_info['is_favorite'] = True
        query = query & (db.idea.id.belongs(favorites))
    if tags:
        log_info['tags'] = tags
        log_info['strict'] = strict
        query = query & (db.tag.tag.belongs(tags))
    
    # Get user favorites
    # Get ideas
    ideas = db(query).select(orderby=db.idea.dateAdded, groupby=db.idea.id)
    clean_ideas = [
        dict(id=i.idea.id,
            userId=i.idea.userId, 
            idea=i.idea.idea, 
            tags=[tag.tag.tag for tag in i.idea.tag_idea.select()],
            favorite=True if i.idea.id in favorites else False
        ) for i in ideas]
    if tags and strict:
        check_tags = set(tags)
        clean_ideas = [i for i in clean_ideas if set(i['tags']) == check_tags]
    
    # Log
    log_info['num_ideas'] = len(ideas)
    log_action(user_id, problem_id, "get_ideas", log_info)

    return json.dumps(clean_ideas)

def add_to_favorites():
    idea = request.vars['id']
    user_id = session.user_id
    timestamp = datetime.datetime.now()
    # Check if it already exists
    check_query = db((db.favorite.idea == idea) & (db.favorite.user_info == user_id))
    favorite = check_query.select().first()
    add_favorite = True
    if favorite:
        # Already exists. Remove it
        check_query.delete()
        add_favorite = False
    else:
        # Doesn't exist. Add it
        db.favorite.insert(
            user_info = user_id,
            idea = idea,
            timestamp = timestamp)
    log_action(user_id, util.get_problem_id(request), "toggle_favorite", {add_favorite: add_favorite, idea: idea})

def get_idea_by_id():
    id = int(request.vars['id'])
    user_id = session.user_id

    idea = db((db.idea.id == id) &
                ((db.idea.id == db.tag_idea.idea) & 
                (db.tag.id == db.tag_idea.tag))
    ).select(orderby=db.idea.dateAdded, groupby=db.idea.id).first()

    clean_idea = dict(id=idea.idea.id, 
        idea=idea.idea.idea, 
        userId=idea.idea.userId,
        tags=[tag.tag.tag for tag in idea.idea.tag_idea.select()])

    # Log
    log_action(user_id, util.get_problem_id(request), 'get_idea_by_id', {idea:id})
    return json.dumps(clean_idea)

def __get_favorites(user_id):
    favorites_rows = db(db.favorite.user_info == user_id).select(db.favorite.idea)
    return [i.idea for i in favorites_rows]