import numpy
import user_models
from operator import itemgetter
from collections import defaultdict
import scipy.stats as stats

def find_n_nearest(reference_user, user_models, n, db):
    # Initialize variables
    reference_tags = reference_user.category_matrix.get_standardized_categories()
    user_item = []
    user_map = dict()
    problem_id = reference_user.problem
    # tags = []
    similarities = []
    # Calculate similarities
    '''
    Result:
    user_item = [
        {t1: n, t2: n, ...},    # u1's data (per user_map)
        {t2: n, t5: n, ...}     # u3's data
    ]
    user_map = { 
        0: u1,
        1: u3,
        2: u2,
        ...
    }
    tags = [t1, t2, t3, ...]
    '''
    all_tags = db((db.tag.problem == problem_id) & (db.tag.replacedBy == None)).select(db.tag.tag) # TODO
    all_tags = [t.tag for t in all_tags]
    # Calculate similarity
    for i, um in enumerate(user_models): # Iterate through the user models to calculate their similarity with the reference
        user_map[i] = um # Update user_map. The user_map maps models to the iteration index (e.g. if the first user id is 54, usar_map[0] == 54)
        std_tags = um.category_matrix.get_standardized_categories() # Gets the standardized list of categories for this user
        similarities.append(calculate_similarity(reference_tags, std_tags, all_tags)) # Calculate similarity between this user and reference model
    # Merge and sort lists by similarity
    merge_lists = [(i, sim) for i,sim in enumerate(similarities)]
    merge_lists = sorted(merge_lists, key=itemgetter(1), reverse=True)
    # Prepare and return n results
    nearest = [(user_map[u[0]], u[1]) for u in merge_lists][0:n]
    return nearest

def infer_categories(reference_user, nearest_users, exclude_existing=False):
    '''
    Returns a list of inferred category intensities for reference_user based on nearest_users
    Returns: a list of two-tuples with category and infered frequency
    [(cat1, 0.31), (cat2, 0.17), (cat3, -0.1),...]

    If exclude_existing==True, only categories that do not exist in reference_user will be returned
    '''
    categories = defaultdict(list)
    reference_categories = reference_user.category_matrix.get_standardized_categories()
    for nn in nearest_users: # For each nearest neighbor...
        nn_categories = nn[0].category_matrix.get_standardized_categories() # ... get their categories...
        for c in nn_categories.keys(): # ... and for each category...
            if (exclude_existing and c not in reference_categories.keys()) or not exclude_existing: #... if it is not in the reference model (that is, the reference model hasn't visited it)
                categories[c].append(nn_categories[c])  #... then add the the list of categories
    results = sorted([(k, numpy.sum(v)) for k,v in categories.items()], key=itemgetter(1), reverse=True)
    return results

def get_inferred_categories(user_id, problem_id, db):
    '''
    I intended this class to not have to access DB at all, but right now I can't see a better way to do this.
    '''
    user_model = user_models.UserModel(user_id, problem_id)
    all_users = db(
        (db.idea.problem == problem_id) & 
        (db.idea.userId == db.user_info.id) &
        (db.idea.userId <> user_id)
    ).select(db.idea.userId, db.user_info.userId, distinct=True)
    models = []
    for u in all_users:
        models.append(user_models.UserModel(u.idea.userId, problem_id))
    nearest_neighbors = find_n_nearest(user_model, models, 5, db)
    # Infer categories from nearest neighbors
    inferred = infer_categories(user_model, nearest_neighbors, True)
    return inferred

def calculate_similarity(model1, model2, all_tags):
    '''
    model1 and model2 = dict(
        t1: n, 
        t2: n, 
        ...
    )
    '''
    # Create arrays, since dicts don't guarantee order
    m1 = []
    m2 = []
    get_val = lambda d,k: d[k] if k in d else 0 
    for k in all_tags:
        m1.append(get_val(model1, k))
        m2.append(get_val(model2, k))
    sim = stats.pearsonr(m1,m2)
    print(sim)
    return sim[0]