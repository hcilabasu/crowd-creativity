import user_models

def index():
    problems = db(db.problem.id > 0).select()
    users_per_problem = dict()
    regenerated = True if request.vars.regenerated else False
    for p in problems:
        users = db(
            (db.idea.problem == p.id) & 
            (db.idea.userId == db.user_info.id)
        ).select(db.idea.userId, db.user_info.userId, distinct=True)
        users_per_problem[p.id] = users
    return dict(problems=problems, users_per_problem=users_per_problem, regenerated=regenerated)

def usermodel():
    user_id = request.vars['user']
    problem_id = request.vars['problem']

    if not user_id or not problem_id:
        redirect(URL('stats', 'index'))
    # retrieve items
    user = db(db.user_info.id == user_id).select().first()
    problem = db(db.problem.id == problem_id).select().first()

    if not user or not problem:
        redirect(URL('stats', 'index'))

    user_model = user_models.UserModel(user.id, problem.id)
    # user_model = db((db.user_model.user == user_id) & (db.user_model.problem == problem_id)).select().first()
    # transition_graph = user_models.TransitionGraph(user_model.last_cat, user_model.transition_graph).format_graph()
    # user_model.transition_graph = None # reducing amount of data that will be sent back
    return dict(user=user, problem=problem, model=user_model)

def regenerate_models():
    # Delete all models
    db(db.user_model.id > 0).delete()
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
    # Send back to stats
    redirect(URL('stats','index'))