import json
import random
import heapq
from operator import itemgetter
from gluon import current

class UserModel(object):
    ''' This is the main user model class, housing all properties, including the graph and matrix '''

    def __init__(self, user_id, problem_id):
        self.user_id = user_id
        self.problem_id = problem_id
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

    def update(self, new_category):
        db = current.db
        # Update entire model
        self.count_pair += 1
        if self.last_cat != new_category:
            self.count_transition_pairs += 1
        self.last_cat = new_category
        self.transition_graph.update(new_category)
        self.category_matrix.update(new_category)
        db((db.user_model.user == self.user_id) & (db.user_model.problem == self.problem_id)).update(**vars(self))

    def get_inspiration_categories(self, n):
        categories = []
        next_categories = self.transition_graph.get_next_categories(n)
        for i in range(n):
            if random.random() > self.category_switch_ratio: 
                # stay in the same category
                categories.append(self.last_cat)
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

    def update(self, category):
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
    def __init__(self, last_category=None, model_string='[]'):
        self.last_category = last_category
        super(TransitionGraph, self).__init__(model_string)

    def update(self, category):
        # transition graph update logic
        from_node = None
        to_node = None
        for node in self.model:
            # Look for the last category node. This node must exist in correct models.
            if node['tag'] == self.last_category:
                from_node = node
            if node['tag'] == category:
                to_node = node
            # End search if both have been found
            if from_node and to_node:
                break
        # create nodes if they don't exist
        if not from_node:
            # If this is the first node, the from_node will use the new category, as there is no last_category
            from_node_category = self.last_category if self.last_category else category
            from_node = dict(tag=from_node_category,edges=[])
            self.model.append(from_node)
        if (not to_node) and (self.last_category): # if there is no last_category, there is no need for to_node
            to_node = dict(tag=category,edges=[])
            self.model.append(to_node)
        # update edges on from_node
        if self.last_category: # only add edge if this is not the first run (i.e. there is no last_category)
            edge = None
            # Look for edge to update
            for from_node_edge in from_node['edges']:
                if from_node_edge['tag'] == category:
                    # Found edge. Retrieve it.
                    edge = from_node_edge
            if not edge:
                # Edge doesn't exist. Create and add it
                edge = dict(tag=category, count=0)
                from_node['edges'].append(edge)
            # Update count
            edge['count'] += 1
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

    def get_adjacent(self, category):
        ''' Ordered by frequency '''
        adjacent = []
        for node in self.model:
            if node['tag'] == category:
                # Found current node. Get adjacent
                sorted_edges = sorted(node['edges'], key=itemgetter('count'), reverse=True)
        adjacent = [e['tag'] for e in sorted_edges]
        return adjacent

    def get_next_categories(self, n):
        categories = self.get_adjacent(self.last_category)[0:n]
        if len(categories) < n:
            ''' There aren't enough adjacent. Use overall frequency '''
            frequent = self.user_model.category_matrix.get_most_frequent()[0:n-len(categories)]
            categories.extend(frequent)
        # TODO return categories
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

    def update(self, category):
        # category matrix update logic
        if category in self.model.keys():
            self.model[category] += 1
        else:
            self.model[category] = 1
        return self
    
    def get_most_frequent(self):
        most_frequent = sorted(self.model.items(), key=itemgetter(1), reverse=True)
        most_frequent = [t[0] for t in most_frequent]
        return most_frequent
