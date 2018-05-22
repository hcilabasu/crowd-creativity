routers = dict( 
    BASE = dict( 
        default_application='crowdmuse',
        functions=dict(
            brainstorm=['index','add_idea','check_updates','get_all_tags']
        )
    )
) 

# Error handling
routes_onerror = [
    ('crowdmuse/*', '/error')
]