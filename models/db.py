# -*- coding: utf-8 -*-

#########################################################################
## This scaffolding model makes your app work on Google App Engine too
## File is released under public domain and you can use without limitations
#########################################################################

## if SSL/HTTPS is properly configured and you want all HTTP requests to
## be redirected to HTTPS, uncomment the line below:
# request.requires_https()

from gluon import current

## app configuration made easy. Look inside private/appconfig.ini
from gluon.contrib.appconfig import AppConfig
## once in production, remove reload=True to gain full speed
myconf = AppConfig(reload=True)


if not request.env.web2py_runtime_gae:
    ## if NOT running on Google App Engine use SQLite or other DB
    db = DAL(myconf.take('db.uri'), pool_size=myconf.take('db.pool_size', cast=int), check_reserved=['mysql'])
    db_scheduler = DAL(myconf.take('db.uri'), pool_size=myconf.take('db.pool_size', cast=int), check_reserved=['mysql'])
else:
    ## connect to Google BigTable (optional 'google:datastore://namespace')
    db = DAL('google:datastore+ndb')
    ## store sessions and tickets there
    session.connect(request, response, db=db)
    ## or store session in Memcache, Redis, etc.
    ## from gluon.contrib.memdb import MEMDB
    ## from google.appengine.api.memcache import Client
    ## session.connect(request, response, db = MEMDB(Client()))

# Add db to current
current.db = db

## by default give a view/generic.extension to all actions from localhost
## none otherwise. a pattern can be 'controller/function.extension'
response.generic_patterns = ['*'] if request.is_local else []
## choose a style for forms
response.formstyle = myconf.take('forms.formstyle')  # or 'bootstrap3_stacked' or 'bootstrap2' or other
response.form_label_separator = myconf.take('forms.separator')


## (optional) optimize handling of static files
# response.optimize_css = 'concat,minify,inline'
# response.optimize_js = 'concat,minify,inline'
## (optional) static assets folder versioning
# response.static_version = '0.0.0'
#########################################################################
## Here is sample code if you need for
## - email capabilities
## - authentication (registration, login, logout, ... )
## - authorization (role based authorization)
## - services (xml, csv, json, xmlrpc, jsonrpc, amf, rss)
## - old style crud actions
## (more options discussed in gluon/tools.py)
#########################################################################

from gluon.tools import Auth, Service, PluginManager

auth = Auth(db)
service = Service()
plugins = PluginManager()

## create all tables needed by auth if not custom tables
# auth.define_tables(username=False, signature=False)

## configure email
mail = auth.settings.mailer
mail.settings.server = 'logging' if request.is_local else myconf.take('smtp.server')
mail.settings.sender = myconf.take('smtp.sender')
mail.settings.login = myconf.take('smtp.login')

## configure auth policy
auth.settings.registration_requires_verification = False
auth.settings.registration_requires_approval = False
auth.settings.reset_password_requires_verification = True

#########################################################################
## Define your tables below (or better in another model file) for example
##
## >>> db.define_table('mytable',Field('myfield','string'))
##
## Fields can be 'string','text','password','integer','double','boolean'
##       'date','time','datetime','blob','upload', 'reference TABLENAME'
## There is an implicit 'id integer autoincrement' field
## Consult manual for more options, validators, etc.
##
## More API examples for controllers:
##
## >>> db.mytable.insert(myfield='value')
## >>> rows=db(db.mytable.myfield=='value').select(db.mytable.ALL)
## >>> for row in rows: print row.id, row.myfield
#########################################################################

db.define_table('problem',
    Field('title', 'string', length=50),
    Field('url_id', 'string', unique=True, length=50),
    Field('description', 'string'))

db.define_table('user_info',
    Field('userId', 'string'),
    Field('userCondition', 'integer'),
    Field('initialLogin', 'datetime'))

db.define_table('idea',
    Field('idea','string'), 
    Field('userId','reference user_info'),
    Field('userCondition','integer'), 
    Field('ratings','integer'),
    Field('dateAdded','datetime'),
    Field('pool','boolean'),
    Field('relatedIdeas','list:reference idea'),
    Field('origin', 'string'),
    Field('replacedBy', 'reference idea'),
    Field('sources', 'list:reference idea'))

db.define_table('favorite',
    Field('user_info', 'reference user_info'),
    Field('idea', 'reference idea'),
    Field('timestamp', 'datetime'))
    
db.define_table('tag',
    Field('tag', 'string', unique=True),
    Field('replacedBy', 'reference tag'))
    
db.define_table('tag_idea',
    Field('tag', 'reference tag'),
    Field('idea', 'reference idea'))

db.define_table('action_log',
    Field('actionName', 'string'),
    Field('userId', 'reference user_info'),
    Field('extraInfo', 'string'), # any other necessary contextual information
    Field('dateAdded', 'datetime'))

db.define_table('sessionCondition',
    Field('conditionNumber', 'integer'),
    Field('conditionName', 'string'),
    Field('conditionCount', 'integer'))

db.define_table('task',
    Field('task_type', 'string'),
    Field('idea', 'reference idea'),
    Field('owner', 'reference user_info'), # User who added the idea a task refers to
    Field('exclude_owner', 'boolean'), # If true, the owner of the task cannot perform it
    Field('tags', 'list:reference tag'),
    Field('completed', 'boolean', default=False),
    Field('completed_by', 'reference user_info'),
    Field('completed_timestamp', 'datetime'),
    Field('options', 'string'),
    Field('answer', 'string'))

# DEPRECATED
db.define_table('idea_rating',
    Field('idea', 'reference idea'),
    Field('completed', 'boolean'),
    Field('relativeTo', 'reference idea'), # If the task is comparing the idea in terms of another
    Field('ratingOriginality', 'integer'),
    Field('ratingUsefulness', 'integer'),
    Field('dateCompleted', 'datetime'),
    Field('completedBy', 'string'))

db.define_table('categorization',
    Field('idea', 'reference idea'),
    Field('completed', 'boolean',),
    Field('categorizationType', 'string'), # selectBest / categorize
    Field('suggestedTags', 'list:string'), # Results from suggest tasks
    Field('chosenTags', 'list:string'), # Results from selectBest tasks
    Field('categorized', 'list:string'), # Results from categorize tasks
    Field('completedBy', 'string'))

## after defining tables, uncomment below to enable auditing
# auth.enable_record_versioning(db)