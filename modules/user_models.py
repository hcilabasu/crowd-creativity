import json

class Model(object):
    def __init__(self, model_string):
        self.model = self.parse(model_string)

    def parse(self, model_string):
        json_model = json.loads(model_string)
        return json_model

    def update(self, category):
        return self

    def __str__(self):
        return json.dumps(self.model)

class TransitionGraph(Model):
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
    def __init__(self, last_category, model_string='[]'):
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
            # If this is the first node, the from_node will use the new category, as there is no last_castegory
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

class CategoryMatrix(Model):
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
