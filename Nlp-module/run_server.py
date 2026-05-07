#!/usr/bin/env python3
"""Démarrer le serveur NLP avec Gemini Voice Service"""
import os
import sys

# Ajouter le répertoire du projet au PATH
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

# Ignorer les problèmes d'env
os.environ.pop('OPENAI_API_KEY', None)

# Variables d'environnement minimales
os.environ['GEMINI_API_KEY'] = os.getenv('GEMINI_API_KEY', '')

# Lancer Uvicorn
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(
        app="app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        log_level="info"
    )
