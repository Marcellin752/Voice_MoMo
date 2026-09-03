# test_voice_pipeline.py est un script de diagnostic manuel (python test_voice_pipeline.py)
# qui appelle un serveur live sur localhost:8000 — pas une suite pytest. Ses fonctions
# test_*() n'ont pas de fixtures pytest (ex: test_3_voice_command(token)), donc la
# collecte automatique le fait échouer avec des erreurs sans rapport avec le code.
collect_ignore = ["test_voice_pipeline.py"]
