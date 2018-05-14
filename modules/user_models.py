import json
import random
import heapq
from collections import Counter
from operator import itemgetter
from gluon import current

class UserModel(object):
    ''' This is the main user model class, housing all properties, including the graph and matrix '''

    def __init__(self, user_id, problem_id):
        self.user = user_id
        self.problem = problem_id
        self.exists = False # Flag whether this model already exists in DB or not
        # Retrieve user model from DB
        db = current.db
        db_user_model = db((db.user_model.user == user_id) & (db.user_model.problem == problem_id)).select().first()
        if db_user_model:
            self.exists = True
            # Create matrix and graph
            self.transition_graph = TransitionGraph(db_user_model.last_cat, db_user_model.transition_graph)
            self.category_matrix = CategoryMatrix(db_user_model.category_matrix)
            # Create other properties
            self.last_cat = db_user_model.last_cat
            self.count_pair = db_user_model.count_pair
            self.count_transition_pairs = db_user_model.count_transition_pairs
            self.category_switch_ratio = self.count_transition_pairs / float(self.count_pair)
        else:
            self.last_cat = None
            self.count_pair = 0
            self.count_transition_pairs = 0
            self.category_switch_ratio = None
            self.transition_graph = TransitionGraph()
            self.category_matrix = CategoryMatrix()
        # Add a reference to the user model
        self.transition_graph.user_model = self
        self.category_matrix.user_model = self

    def update(self, new_categories):
        ''' new_categories is an array. It's length can be 1 or 2'''
        db = current.db
        # Update entire model
        self.count_pair += 1
        # Update matrix and graph
        self.transition_graph.update(new_categories)
        self.category_matrix.update(new_categories)
        # Check if there was a transition
        if Counter(self.last_cat) != Counter(new_categories):
            self.count_transition_pairs += 1
        self.last_cat = new_categories
        query = ((db.user_model.user == self.user) & (db.user_model.problem == self.problem))
        if db(query).isempty():
            # Create new model
            db.user_model.insert(**vars(self))
        else:
            # update model
            db(query).update(**vars(self))

    def get_inspiration_categories(self, n):
        categories = []
        next_categories = self.transition_graph.get_next_categories(n)
        for i in range(n):
            if random.random() > self.category_switch_ratio: 
                # stay in the same category
                # if len(self.last_cat) > 1, we randomly choose from the current categories
                categories.append(random.choice(self.last_cat)) 
            else:
                categories.append(next_categories.pop(0))
        return categories

class ModelRepresentation(object):
    ''' This is the super class for the matrix and graph representations '''
    def __init__(self, model_string):
        self.model = self.parse(model_string)

    def parse(self, model_string):
        json_model = json.loads(model_string)
        return json_model

    def update(self, categories):
        raise NotImplementedError

    def __str__(self):
        return json.dumps(self.model)

class TransitionGraph(ModelRepresentation):
    '''
    Stores a matrix 
    json string syntax:
    [
        {
            tag:'',                     // node name
            edges:[                     // list of edges
                {tag:'', count:i},     // edge name and count
                ...
            ]
        },
        ...
    ]
    '''
    def __init__(self, last_cat=None, model_string='[]'):
        self.last_cat = last_cat
        super(TransitionGraph, self).__init__(model_string)

    def update(self, new_categories):
        ''' transition graph update logic '''
        from_nodes = []
        to_nodes = []
        last_cat = self.user_model.last_cat if self.user_model.last_cat != None else [] # Get last category from user model
        categories = list(new_categories) # Duplicate list to avoid changing the original one
        # The purpose for this first loop is to get pointers to the nodes that need to be updated
        # Since ideas can have multiple tags, we need to treat from and to nodes as lists
        for node in self.model:
            if node['tag'] in last_cat: # Find nodes the user is transitioning FROM
                from_nodes.append(node) # At the end of the loop, len(from_nodes) should be equal to len(last_cat)
            if node['tag'] in categories: # Find nodes the user is transitioning TO
                to_nodes.append(node)
                categories.remove(node['tag']) # Remove from categories to find out which ones need to be created
            # If there are no more nodes in last_cat or categories, quit search.
            if len(last_cat) == 0 and len(categories) == 0: break

        # Create TO nodes that don't exist yet
        for c in categories:
            node = dict(tag=c,edges=[])
            to_nodes.append(node) # Keep a reference
            self.model.append(node) # Add to model

        # Update edges on FROM nodes
        for f_node in from_nodes:
            for t_node in to_nodes:
                found_edge = None
                # Look for an existing edge between f_node and t_node
                for edge in f_node['edges']:
                    if edge['tag'] == t_node['tag']:
                        # Found edge. Retrieve it.
                        found_edge = edge
                # Check if edge exists. If it doesn't, create it. Then increment count.
                if not found_edge:
                    # Edge doesn't exist. Create and add it
                    found_edge = dict(tag=t_node['tag'], count=0)
                    f_node['edges'].append(found_edge)
                # Update count
                found_edge['count'] += 1
        return self

    def format_graph(self):
        '''
        Formats the graph in the following format:
        Used for the D3.js visualization.
        {
            nodes: [
                {tag: ''}
            ],
            edges: [
                {source:i, target:j, count:n} // where i and j are indexes in the nodes array
            ]
        }
        '''
        nodes = []
        nodes_index = dict()
        edges = []
        # Iterate through the nodes
        for i, node in enumerate(self.model):
            # deal with nodes
            nodes.append(dict(tag=node['tag']))
            nodes_index[node['tag']] = i
            # deal with edges
            for edge in node['edges']:
                edges.append(dict(source=i, target=edge['tag'], count=edge['count']))
        # switch edge target names to index
        for edge in edges:
            edge['target'] = nodes_index[edge['target']]
        return json.dumps(dict(nodes=nodes,edges=edges))

    def get_adjacent(self, categories):
        ''' Ordered by frequency '''
        edges = []
        for node in self.model:
            if node['tag'] in categories:
                # Found one of the current nodes. Get adjacent
                edges.extend(node['edges'])
        # sort list of edges by count
        sorted_edges = sorted(edges, key=itemgetter('count'), reverse=True)
        adjacent = [e['tag'] for e in sorted_edges]
        return adjacent

    def get_next_categories(self, n):
        categories = self.get_adjacent(self.last_cat)[0:n]
        if len(categories) < n:
            ''' There aren't enough adjacent. Use overall frequency '''
            frequent = self.user_model.category_matrix.get_most_frequent()[0:n-len(categories)]
            categories.extend(frequent)
        return categories

class CategoryMatrix(ModelRepresentation):
    '''
    Stores a set of categories and counts
    {
        'category': i,
        ...
    }
    '''
    def __init__(self, model_string='{}'):
        super(CategoryMatrix, self).__init__(model_string)

    def update(self, categories):
        # category matrix update logic
        for category in categories:
            if category in self.model.keys():
                self.model[category] += 1
            else:
                self.model[category] = 1
        return self
    
    def get_most_frequent(self):
        most_frequent = sorted(self.model.items(), key=itemgetter(1), reverse=True)
        most_frequent = [t[0] for t in most_frequent]
        return most_frequent
