'''
This module consists of a set of functions. Each function corresponds to one test scenario.
The name of the function will be the problem's url id, description, and title.
A function must return a set of tag sequences, comprised of a list of lists of tuples. 
Each tuple represents one or two tags, and each lists represents a sequence of ideas for one dummy user

TODO This should probably be moved to an external file (e.g. a CSV file with the list of tags).

'''

def testproblem1():
    tag_sequences = [
        [['blue'], ['orange'], ['pink','blue']],
        [['red'], ['blue'], ['blue']],
        [['green']],
        [['orange','green'], ['orange']]
    ]
    return tag_sequences