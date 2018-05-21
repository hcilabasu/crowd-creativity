import numpy
import user_models
from operator import itemgetter
from collections import defaultdict

def find_n_nearest(reference_user, user_models, n):
    print('')
    # Initialize variables
    reference = reference_user.category_matrix.get_standardized_categories()
    user_item = []
    user_map = dict()
    tags = []
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
    for i, um in enumerate(user_models):
        user_map[i] = um # Update user_map
        user_tags = dict()
        std_tags = um.category_matrix.get_standardized_categories()
        for k in std_tags.keys():
            if k not in tags: # Add tag to tag master list
                tags.append(k) # Update tags
        user_item.append(std_tags)
        # Find nearest neighbours to reference model
        similarities.append(calculate_similarity(reference, std_tags))
    # Merge and sort lists by similarity
    merge_lists = [(i, sim) for i,sim in enumerate(similarities)]
    merge_lists = sorted(merge_lists, key=itemgetter(1), reverse=False)
    # Prepare and return results
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
    for nn in nearest_users:
        nn_categories = nn[0].category_matrix.get_standardized_categories()
        for c in nn_categories.keys():
            if (exclude_existing and c not in reference_categories.keys()) or not exclude_existing:
                categories[c].append(nn_categories[c])
    results = sorted([(k, numpy.mean(v)) for k,v in categories.items()], key=itemgetter(1), reverse=True)
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
    nearest_neighbors = find_n_nearest(user_model, models, 5)
    # Infer categories from nearest neighbors
    inferred = infer_categories(user_model, nearest_neighbors, True)
    return inferred

def calculate_similarity(model1, model2):
    '''
    model1 and model 2 = dict(
        t1: n, 
        t2: n, 
        ...
    )
    '''
    dists = []
    for k in model1.keys():
        if k in model2:
            dists.append(abs(model1[k] - model2[k]))
    # TODO Find a better function for similarity
    sim = numpy.mean(dists)
    return sim