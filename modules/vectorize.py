#!/usr/bin/env python
# -*- coding: utf-8 -*-

'''
* Stemmer, tokenizer, and stopword filter: Bird, Steven, Edward Loper and Ewan Klein (2009), Natural Language Processing with Python. O’Reilly Media Inc.
* TF_IDF: by Harry R. Schwartz, https://github.com/hrs/python-tf-idf
'''

from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
from nltk.tokenize import wordpunct_tokenize

stop_words = set(stopwords.words('english'))
stop_words.update(['-', '--', '---', '.', ',', '"', "'", '?', '??', '???', '!', '!!', '!!!', ':', ';', '(', ')', '[', ']', '{', '}']) # remove it if you need punctuation 
stem = PorterStemmer()

def vectorize(doc):
    return [stem.stem(i.lower()) for i in wordpunct_tokenize(doc) if i.lower() not in stop_words]
    
if __name__ == "__main__":
    print(vectorize("this is my very interesting--and innovative--idea for solving the problem, as stated in the prompt above!!!"))
    
