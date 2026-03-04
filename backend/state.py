# Shared model store — avoids circular imports
models = {}

def get_models():
    return models