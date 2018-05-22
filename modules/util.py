from gluon import current

def get_problem_title(request):
    return request.args(0)

def get_problem_id(request):
    title = get_problem_title(request)
    db = current.db
    id = db(db.problem.title == title).select().first().id
    return id