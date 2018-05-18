import numpy
from gluon import current
from operator import itemgetter

def find_n_nearest(reference_user, user_models, n):
    print('')
    # Initialize variables
    reference = reference_user.category_matrix.get_standardized_categories()
    user_item = []
    user_map = dict()
    db = current.db
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