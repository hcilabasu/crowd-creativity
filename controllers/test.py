dictionary = None
corpus = None



def get_ideas():
	idea = db(db.idea.id > 0).select(orderby='<random>').first()
	return 

def __create_dictionary_and_corpus(documents):
	global dictionary
	global corpus
	global lsi
	
	dictionary = corpora.Dictionary.load('/Datasets/ideation.dict') 
	corpus = corpora.MmCorpus('/Datasets/ideation.mm')

	lsi = models.LsiModel(corpus, id2word=dictionary, num_topics=100)

	return (dictionary, corpus, lsi)