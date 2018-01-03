import json

'''
Controller for functions realted to idea workspace view
'''

def get_ideas():
    user_id = session.user_id
    added_by = request.vars.added_by
    query = (db.idea.id == db.tag_idea.idea) & (db.tag.id == db.tag_idea.tag)
    if added_by:
        query = query & (db.idea.userId == user_id)

    ideas = db(query).select(orderby=db.idea.id, groupby=db.idea.id)
    clean_ideas = [
        dict(id=i.idea.id,
            userId=i.idea.userId, 
            idea=i.idea.idea, 
            tags=[tag.tag.tag for tag in i.idea.tag_idea.select()]
        ) for i in ideas]
    return json.dumps(clean_ideas)

def get_idea_by_id():
    id = int(request.vars['id'])

    idea = db((db.idea.id == id) &
                ((db.idea.id == db.tag_idea.idea) & 
                (db.tag.id == db.tag_idea.tag))
    ).select(orderby=~db.idea.id, groupby=db.idea.id).first()

    clean_idea = dict(id=idea.idea.id, 
        idea=idea.idea.idea, 
        userId=idea.idea.userId,
        tags=[tag.tag.tag for tag in idea.idea.tag_idea.select()])

    return json.dumps(clean_idea)

def get_all_ideas():
    ideas = db((db.idea.id == db.tag_idea.idea) & 
               (db.tag.id == db.tag_idea.tag)
    ).select(orderby=~db.idea.id, groupby=db.idea.id)
    clean_ideas = [dict(id=i.idea.id, idea=i.idea.idea) for i in ideas]
    return json.dumps(clean_ideas)