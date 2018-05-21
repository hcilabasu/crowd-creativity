import user_models
import collab_filter
import json

def index():
    problems = db(db.problem.id > 0).select()
    users_per_problem = dict()
    regenerated = True if request.vars.regenerated else False
    for p in problems:
        users_per_problem[p.id] = __get_users_in_problem(p.id)
    return dict(problems=problems, users_per_problem=users_per_problem, regenerated=regenerated)

def usermodel():
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
    nearest_neighbors = collab_filter.find_n_nearest(user_model, models, 5)
    # Infer categories from nearest neighbors
    inferred = collab_filter.infer_categories(user_model, nearest_neighbors, True)
    return dict(
        user=user, 
        problem=problem, 
        model=user_model, 
        nearest_neighbors=nearest_neighbors, 
        inferred=inferred,
        inferred_json=json.dumps(inferred))

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

'''
Returns a list of all users who contributed in a problem.
blacklist: list of ids of users to be excluded from this list
'''
def __get_users_in_problem(problem_id, blacklist=[]):
    return db(
        (db.idea.problem == problem_id) & 
        (db.idea.userId == db.user_info.id) &
        (~db.idea.userId.belongs(blacklist))
    ).select(db.idea.userId, db.user_info.userId, distinct=True)