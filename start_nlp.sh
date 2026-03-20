#!/bin/bash
cd /home/satignon/Tek2/VoiceMomo/Voice_MoMo/Nlp-module
source venv/bin/activate
uvicorn app.main:app --reload --port 8001
