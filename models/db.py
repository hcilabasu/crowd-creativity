# -*- coding: utf-8 -*-
from random import SystemRandom

# Track module changes
from gluon.custom_import import track_changes; track_changes(True)
from gluon import current
from gluon.contrib.appconfig import AppConfig

# Adjust settings depending on environment
settings = dict()
if request.env.http_host in ('127.0.0.1:8000', 'localhost:8000', '192.168.0.8:8000'):
    settings['is_development'] = True
    myconf = AppConfig(reload=True)
else:
    # Production settings
    settings['is_development'] = False
    myconf = AppConfig()
    request.requires_https()
    # response.optimize_css = 'concat,minify,inline'
    # response.optimize_js = 'concat,minify,inline'

# Setup db
db = DAL(
    myconf.take('db.uri'), 
    pool_size=myconf.take('db.pool_size', cast=int), 
    check_reserved=['mysql'])
db_scheduler = DAL(myconf.take('db.uri'), pool_size=myconf.take('db.pool_size', cast=int), check_reserved=['mysql'])


# Add db to current
current.db = db

## by default give a view/generic.extension to all actions from localhost
## none otherwise. a pattern can be 'controller/function.extension'
response.generic_patterns = ['*'] if request.is_local else []
## choose a style for forms
response.formstyle = myconf.take('forms.formstyle')  # or 'bootstrap3_stacked' or 'bootstrap2' or other
response.form_label_separator = myconf.take('forms.separator')

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

DATA_MAX = myconf.take('db.data_max') # Used for fields that store things such as json code
TEXT_MAX = myconf.take('db.text_max')
SHORT_STRING_MAX = myconf.take('db.short_string_max')

MIGRATE = True
FAKE_MIGRATE = False

STATS_PWD = myconf.take('stats.pwd')

# Random variable for default user model condition
SECURE = SystemRandom()

# Conditions
settings['conditions'] = dict(
    control=1,
    subtle=2,
    overt=3,
    all=4)

db.define_table('problem',
    Field('title', 'string', length=SHORT_STRING_MAX),
    Field('url_id', 'string', unique=True, length=SHORT_STRING_MAX),
    Field('description', 'text', length=TEXT_MAX),
    Field('public', 'boolean', default=True),
    Field('study_session', 'boolean', default=False),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

db.define_table('user_info',
    Field('userId', 'string', length=SHORT_STRING_MAX),
    Field('userCondition', 'integer'), # Deprecated in favor of the user model condition
    Field('initialLogin', 'datetime'),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

db.define_table('idea',
    Field('idea','text', length=TEXT_MAX), 
    Field('userId','reference user_info'),
    Field('problem', 'reference problem'),
    Field('userCondition','integer'), 
    Field('ratings','integer'),
    Field('dateAdded','datetime'),
    Field('pool','boolean'),
    Field('relatedIdeas','list:reference idea'),
    Field('origin', 'string'),
    Field('replacedBy', 'reference idea'),
    Field('sources', 'list:reference idea'),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

db.define_table('favorite',
    Field('user_info', 'reference user_info'),
    Field('idea', 'reference idea'),
    Field('timestamp', 'datetime'),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)
    
db.define_table('tag',
    Field('tag', 'string', length=SHORT_STRING_MAX),
    Field('problem', 'reference problem'),
    Field('replacedBy', 'reference tag'),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)
    
db.define_table('tag_idea',
    Field('tag', 'reference tag'),
    Field('idea', 'reference idea'),
    Field('replaced_tag', 'reference tag'),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

db.define_table('action_log',
    Field('actionName', 'string', length=SHORT_STRING_MAX),
    Field('userId', 'reference user_info'),
    Field('problem', 'reference problem'),
    Field('extraInfo', 'text', length=DATA_MAX), # any other necessary contextual information
    Field('dateAdded', 'datetime'),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

db.define_table('sessionCondition',
    Field('conditionNumber', 'integer'),
    Field('conditionName', 'string'),
    Field('conditionCount', 'integer'),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

db.define_table('task',
    Field('task_type', 'string', length=SHORT_STRING_MAX),
    Field('problem', 'reference problem'),
    Field('idea', 'reference idea'),
    Field('owner', 'reference user_info'), # User who added the idea a task refers to
    Field('exclude_owner', 'boolean'), # If true, the owner of the task cannot perform it
    Field('tags', 'list:reference tag'),
    Field('completed', 'boolean', default=False),
    Field('completed_by', 'reference user_info'),
    Field('completed_timestamp', 'datetime'),
    Field('pool', 'boolean'), # Should match the idea itself
    Field('options', 'text', length=DATA_MAX),
    Field('answer', 'text', length=DATA_MAX),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

db.define_table('user_model',
    Field('user', 'reference user_info'),
    Field('timestamp', 'datetime'),
    Field('problem', 'reference problem'),
    Field('user_condition', 'integer'),
    Field('last_cat', 'list:string', length=SHORT_STRING_MAX),
    Field('num_ideas', 'integer'),
    Field('count_pair', 'integer'),
    Field('count_transition_pairs', 'integer'),
    Field('pool', 'boolean', default=False),
    Field('transition_graph', 'text', length=DATA_MAX),
    Field('category_matrix', 'text', length=DATA_MAX),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

db.define_table('visualization_cache',
    Field('problem', 'reference problem'),
    Field('type', 'string'),
    Field('cache', 'text', length=DATA_MAX),
    Field('timestamp', 'datetime'),
    migrate=MIGRATE,
    fake_migrate=FAKE_MIGRATE)

## after defining tables, uncomment below to enable auditing
# auth.enable_record_versioning(db)