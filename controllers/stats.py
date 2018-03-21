import user_models

def usermodel():
    user_id = request.vars['user']
    problem_id = request.vars['problem']

    if not user_id or not problem_id:
        redirect(URL('default', 'index'))
    # retrieve items
    user = db(db.user_info.id == user_id).select().first()
    problem = db(db.problem.id == problem_id).select().first()
    user_model = db((db.user_model.user == user_id) & (db.user_model.problem == problem_id)).select().first()
    transition_graph = user_models.TransitionGraph(user_model.last_cat, user_model.transition_graph).format_graph()
    user_model.transition_graph = None # reducing amount of data that will be sent back
    return dict(user=user, problem=problem, model=user_model, transition_graph=transition_graph)