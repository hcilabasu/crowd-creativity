#!/usr/bin/env python
import logging
from gensim import corpora, models, similarities, matutils
from singleton import Singleton

logger = logging.getLogger("web2py.app.crowdcreativity")
logger.setLevel(logging.INFO)

@Singleton
class LSA_Comparer:

    def __init__(self):
        logger.info('Instantiating LSA model...')
        self.num_topics = 100
        self.dictionary = corpora.Dictionary.load('/Datasets/ideation.dict') 
        self.corpus = corpora.MmCorpus('/Datasets/ideation.mm')
        self.lsi = models.LsiModel(self.corpus, id2word=self.dictionary, num_topics=self.num_topics)
        logger.info('Instantiated LSA model')

    def compare_strings(self, s1, s2):
        # Build vector for doc1 
        vec_bow1 = self.dictionary.doc2bow(s1.lower().split())
        vec_lsi1 = self.lsi[vec_bow1] # convert the query to LSI space
        
        # Build vector for doc2
        vec_bow2 = self.dictionary.doc2bow(s2.lower().split())
        vec_lsi2 = self.lsi[vec_bow2]

        # Calculate cosine similarity
        sim = matutils.cossim(vec_lsi1, vec_lsi2)
        return sim
