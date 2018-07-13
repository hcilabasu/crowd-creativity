import json
import random
import heapq
import numpy
import datetime
import collab_filter
import util
from collections import Counter
from operator import itemgetter
from gluon import current, settings
from random import SystemRandom

CONDITIONS = dict(control=1,subtle=2,overt=3,all=4)

class UserModel(object):
    ''' This is the main user model class, housing all properties, including the graph and matrix '''

    def __init__(self, user_id, problem_id):
        self.user = user_id
        self.problem = problem_id
        self.exists = False # Flag whether this model already exists in DB or not
        # Retrieve user model from DB
        db = current.db
        db_user_model = db((db.user_model.user == user_id) & (db.user_model.problem == problem_id)).select().first()
        if db_user_model and db_user_model.last_cat != None:
            self.exists = True
            # Create matrix and graph
            # TODO make these two be lazy loaded
            self.transition_graph = TransitionGraph(db_user_model.last_cat, db_user_model.transition_graph)
            self.category_matrix = CategoryMatrix(db_user_model.category_matrix)
            # Create other properties
            self.user_condition = db_user_model.user_condition
            self.last_cat = db_user_model.last_cat
            self.count_pair = db_user_model.count_pair
            self.timestamp = db_user_model.timestamp
            self.count_transition_pairs = db_user_model.count_transition_pairs
            count_pairs = float(self.count_pair)
            self.category_switch_ratio = 0 if count_pairs == 0 else self.count_transition_pairs / count_pairs
        else:
            if db_user_model:
                condition = db_user_model.user_condition
            else:
                condition = -1
            self.user_condition = condition
            self.last_cat = None
            self.count_pair = 0
            self.count_transition_pairs = 0
            self.category_switch_ratio = None
            self.transition_graph = TransitionGraph()
            self.category_matrix = CategoryMatrix()
            # Log
            current.log_action(user_id, problem_id, 'create_user_model', {'condition':self.user_condition})
        # Add a reference to the user model
        self.transition_graph.user_model = self
        self.category_matrix.user_model = self

    def update(self, new_categories):
        ''' new_categories is an array. It's length can be 1 or 2'''
        db = current.db
        # Assign condition if this is the first idea
        if self.user_condition == -1:
            self.user_condition = util.get_available_conditions().conditionNumber
        # Update timestamp
        self.timestamp = datetime.datetime.now()
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
        update_dict = vars(self)
        for k in self.__blacklist():
            update_dict.pop(k, None)
        if db(query).isempty():
            # Create new model
            db.user_model.insert(**update_dict)
        else:
            # update model
            db(query).update(**update_dict)
    
    def __blacklist(self):
        ''' Returns a list of self variables that do not belong in the db '''
        return [
            'exists',
            'category_switch_ratio'
        ]

    def get_num_ideas(self):
        return self.count_pair + 1

    def get_breadth(self):
        return self.category_matrix.get_breadth()

    def get_depth_avg(self):
        return self.category_matrix.get_depth_avg()
    
    def get_depth_max(self):
        return self.category_matrix.get_depth_max()

    def get_inspiration_categories(self, n):
        ''' 
        Returns a list of categories to be used for the inspiration.
        If there are none (or the condition doesn't employ adaptive inspirations), return empty list. 
        '''
        categories = []
        if self.last_cat and self.has_adaptive_inspirations(): # Check if the user has ideated before, or if conditions should be adaptive
            next_categories = self.transition_graph.get_next_categories(n)
            for i in range(n):
                if random.random() > self.category_switch_ratio: 
                    # stay in the same category
                    # if len(self.last_cat) > 1, we randomly choose from the current categories
                    categories.append(random.choice(self.last_cat)) 
                else:
                    categories.append(next_categories.pop(0))
        # Log
        current.log_action(self.user, self.problem, 'get_inspiration_categories', {'tags': categories})
        return categories
    
    def get_ordered_tags(self):
        ''' Returns a list of all the tags in the current problem, ordered by usefulness to current user '''
        user_id = self.user
        problem_id = self.problem
        db = current.db
        ordered_tags = []
        # Get all tags
        tags = db((db.tag.id > 0) & (db.tag.replacedBy == None) & (db.tag.problem == problem_id)).select(orderby='<random>').as_list()
        tags = [t['tag'] for t in tags]
        if self.last_cat and self.has_adaptive_views(): # Check if the user has ideated before
            # Start sequence:
            # 1: current category
            for c in self.last_cat:
                ordered_tags.append(c)
                tags.remove(c)
            # 2: adjacent categories
            adjacent = self.transition_graph.get_adjacent(self.last_cat)
            for t in adjacent:
                if t not in ordered_tags: # if there's a self loop and t is the current category, it shouldn't be added
                    ordered_tags.append(t)
                    tags.remove(t)
            # 3: inferred new categories (collab. filtering)
            inferred = collab_filter.get_inferred_categories(self.user, self.problem, db)
            for i in inferred:
                if i[0] not in ordered_tags:
                    ordered_tags.append(i[0])
                    tags.remove(i[0])
            # 4: other visited categories (ordered by quantity)
            frequent = self.category_matrix.get_most_frequent()
            for f in frequent:
                if f not in ordered_tags:
                    ordered_tags.append(f)
                    tags.remove(f)
            # Merge lists
            ordered_tags.extend(tags)
            tags = ordered_tags
        # Log
        current.log_action(self.user, self.problem, 'get_ordered_tags', {'tags': tags})
        return tags

    def has_adaptive_inspirations(self):
        return self.user_condition in (CONDITIONS['overt'], CONDITIONS['all'])

    def has_adaptive_views(self):
        return self.user_condition in (CONDITIONS['subtle'], CONDITIONS['all'])


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
        if len(categories) < n:
            # Even adding the frequent categories wasn't enough. Repeat list until it's enough
            i = 0
            while len(categories) < n:
                categories.append(categories[i])
                i += 1
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

    def get_breadth(self):
        return len(self.model.keys())

    def get_depth_avg(self):
        if self.get_breadth() > 0:
            return sum(self.model.values()) / float(self.get_breadth())
        else:
            return 0

    def get_depth_max(self):
        return max(self.model.values())
    
    def get_most_frequent(self):
        most_frequent = sorted(self.model.items(), key=itemgetter(1), reverse=True)
        most_frequent = [t[0] for t in most_frequent]
        return most_frequent

    def get_standardized_categories(self):
        values = [self.model[k] for k in self.model.keys()]
        avg = numpy.mean(values)
        sdev = numpy.std(values)
        std_cats = dict()
        for k in self.model.keys():
            if sdev != 0:
                std_cats[k] = (self.model[k] - avg) / sdev
            else:
                std_cats[k] = self.model[k]
        return std_cats

    def format_standardized_json(self):
        return json.dumps(self.get_standardized_categories())
