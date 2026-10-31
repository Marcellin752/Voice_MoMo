# test_voice_pipeline.py est un script de diagnostic manuel (python test_voice_pipeline.py)
# qui appelle un serveur live sur localhost:8000 — pas une suite pytest. Ses fonctions
# test_*() n'ont pas de fixtures pytest (ex: test_3_voice_command(token)), donc la
# collecte automatique le fait échouer avec des erreurs sans rapport avec le code.
collect_ignore = ["test_voice_pipeline.py"]

# Environnement de test hermétique, posé AVANT l'import de l'application (conftest est chargé en premier).
# setdefault : une valeur déjà exportée par le développeur reste prioritaire. La clé Gemini factice
# empêche python-dotenv (config.py) de charger la vraie clé de apps/nlp/.env pendant les tests.
import os

os.environ.setdefault("JWT_SECRET", "test-secret-not-for-production")
os.environ.setdefault("GEMINI_API_KEY", "dummy-key-for-tests")
