import logging
from lsa import LSA_Comparer

logger = logging.getLogger("web2py.app.crowdcreativity")
logger.setLevel(logging.INFO)


def generate_similarities():
    ''' 
    This task generates a similarity comparison between every idea in the DB 
    '''
    logger.info('Starting generate_similarities()')
    # Get the maximum idea
    logger.info('   Retrieving new IDs')
    max_query = db.idea_similarity.idea_b.max()
    last_evaluated_id = db(db.idea_similarity.idea_b > 0).select(max_query).first()[max_query]
    
    if last_evaluated_id == None:
        last_evaluated_id = 0
    ideas = db((db.idea.id > last_evaluated_id) & (db.idea.pool == True)).select()

    # get all non-evaluated ideas
    comparer = LSA_Comparer.Instance()  
    if len(ideas) > 0:
        # Move comparer assignment here when I'm sure that the singleton works
        # this function sets idea_a to the one with the lowest id 
        order_ideas = lambda idea_a, idea_b : (idea_a, idea_b) if idea_a.id < idea_b.id else (idea_b, idea_a)

        logger.info('   New ideas found. Doing comparisons')
        for i in range(0,len(ideas)):
            for j in range(i+1,len(ideas)):
                idea_a = ideas[i]
                idea_b = ideas[j]
                # Do comparison
                sim = comparer.compare_strings(idea_a.idea, idea_b.idea)
                a, b = order_ideas(idea_a, idea_b) 
                db.idea_similarity.insert(
                    idea_a = a,
                    idea_b = b,
                    similarity = sim)
        db.commit()
    else:
        logger.info('   No new ideas found')
    logger.info('Finished generate_similarities()')


# Instantiate scheduler
from gluon.scheduler import Scheduler
scheduler = Scheduler(db_scheduler)

# scheduler.queue_task(one_plus_one, pvars=dict(a=1, b=1), repeats=0, period=30)