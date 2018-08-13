routers = dict( 
    BASE = dict( 
        default_application='crowdmuse',
        functions=dict(
            brainstorm=['index','add_idea','check_updates','get_all_tags','reset_problem']
        )
    )
) 

# Error handling
routes_onerror = [
    ('crowdmuse/*', '/error')
]