#!/usr/bin/env python3
"""
🔍 TEST COMPLETO DEL PIPELINE VOCAL
Diagnostica cada paso desde el audio hasta la respuesta
"""

import requests
import json
import sys
import time
from pathlib import Path

# Configuración
BACKEND_URL = "http://localhost:8000"
TEST_AUDIO_PATH = "test_audio.wav"

def test_1_backend_health():
    """Test 1: ¿Backend está respondiendo?"""
    print("\n" + "="*60)
    print("TEST 1: Backend Health")
    print("="*60)
    
    try:
        response = requests.get(f"{BACKEND_URL}/api/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Backend respondiendo:")
            print(f"   Status: {data.get('status')}")
            print(f"   Service: {data.get('service')}")
            print(f"   Port: 8000")
            return True
        else:
            print(f"❌ Backend respondiendo con error: {response.status_code}")
            return False
    except requests.exceptions.Timeout:
        print(f"❌ TIMEOUT: Backend no responde (5s)")
        return False
    except requests.exceptions.ConnectionError:
        print(f"❌ NO HAY CONEXIÓN: ¿Backend está corriendo en {BACKEND_URL}?")
        return False
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
        return False

def test_2_login():
    """Test 2: ¿Login funcionando?"""
    print("\n" + "="*60)
    print("TEST 2: Authentication (Login)")
    print("="*60)
    
    try:
        response = requests.post(
            f"{BACKEND_URL}/api/auth/login",
            json={"phone": "0197722311", "pin": "1234"},
            timeout=5
        )
        if response.status_code == 200:
            data = response.json()
            token = data.get('token')
            if token:
                print(f"✅ Login exitoso:")
                print(f"   Token obtenido: {token[:30]}...")
                print(f"   User: {data.get('user', {}).get('name')}")
                return token
            else:
                print(f"❌ Login sin token en respuesta")
                print(f"   Response: {json.dumps(data, indent=2)}")
                return None
        else:
            print(f"❌ Login falló: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
        return None

def create_test_audio():
    """Crear un pequeño archivo de audio WAV para testing"""
    print("\n" + "="*60)
    print("PREPARACIÓN: Generando audio de prueba")
    print("="*60)
    
    try:
        # Crear un WAV mínimo (esto es un hack para testing)
        import wave
        import struct
        
        # Parámetros
        sample_rate = 16000
        duration = 1  # 1 segundo
        frequency = 440  # La4
        
        # Generar datos de audio
        samples = []
        for i in range(int(sample_rate * duration)):
            value = int(32767.0 * 0.5 * float(i) / (sample_rate * duration))
            samples.append(value)
        
        # Escribir WAV
        with wave.open(TEST_AUDIO_PATH, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(struct.pack('<' + 'h'*len(samples), *samples))
        
        file_size = Path(TEST_AUDIO_PATH).stat().st_size
        print(f"✅ Audio de prueba creado: {TEST_AUDIO_PATH}")
        print(f"   Tamaño: {file_size} bytes")
        print(f"   Duración: {duration}s @ {sample_rate}Hz")
        return True
    except Exception as e:
        print(f"❌ Error generando audio: {type(e).__name__}: {e}")
        return False

def test_3_voice_command(token):
    """Test 3: ¿Endpoint /api/voice-command funciona?"""
    print("\n" + "="*60)
    print("TEST 3: Voice Command Processing")
    print("="*60)
    
    if not Path(TEST_AUDIO_PATH).exists():
        print(f"❌ Audio de prueba no encontrado: {TEST_AUDIO_PATH}")
        return False
    
    try:
        with open(TEST_AUDIO_PATH, 'rb') as f:
            files = {'audio_file': ('test.wav', f, 'audio/wav')}
            
            headers = {}
            if token:
                headers['Authorization'] = f'Bearer {token}'
                print(f"   Enviando con token JWT")
            else:
                print(f"   ⚠️ Enviando SIN token JWT")
            
            print(f"📤 Enviando audio ({Path(TEST_AUDIO_PATH).stat().st_size} bytes)...")
            
            start = time.time()
            response = requests.post(
                f"{BACKEND_URL}/api/voice-command",
                files=files,
                headers=headers,
                timeout=30  # Timeout más largo para Gemini
            )
            elapsed = time.time() - start
            
            print(f"⏱️  Tiempo de respuesta: {elapsed:.2f}s")
            print(f"📥 Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Procesamiento exitoso:")
                print(f"   Intent: {data.get('intent')}")
                print(f"   Message: {data.get('message')}")
                print(f"   Confidence: {data.get('metadata', {}).get('confidence')}")
                print(f"   Understood: {data.get('understood_text')}")
                return True
            else:
                print(f"❌ Error procesando: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data.get('error')}")
                    print(f"   Details: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Response: {response.text[:500]}")
                return False
                
    except requests.exceptions.Timeout:
        print(f"❌ TIMEOUT: Gemini tardó más de 30s")
        print(f"   Posible causa: API Gemini lenta o sin conexión")
        return False
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_4_check_env():
    """Test 4: ¿Configuración correcta?"""
    print("\n" + "="*60)
    print("TEST 4: Configuration Check")
    print("="*60)
    
    try:
        from dotenv import load_dotenv
        import os
        
        # Cargar .env
        env_file = Path(__file__).parent / "Voice_MoMo" / "Nlp-module" / ".env"
        if env_file.exists():
            load_dotenv(env_file)
            print(f"✅ Archivo .env encontrado: {env_file}")
        else:
            print(f"❌ Archivo .env no encontrado en: {env_file}")
            return False
        
        # Verificar variables críticas
        gemini_key = os.getenv('GEMINI_API_KEY')
        if gemini_key:
            print(f"✅ GEMINI_API_KEY: {gemini_key[:20]}...")
        else:
            print(f"❌ GEMINI_API_KEY: NO ENCONTRADA")
            return False
        
        jwt_secret = os.getenv('JWT_SECRET')
        if jwt_secret:
            print(f"✅ JWT_SECRET: presente")
        else:
            print(f"⚠️  JWT_SECRET: no configurada (usando default)")
        
        return True
    except Exception as e:
        print(f"❌ ERROR: {type(e).__name__}: {e}")
        return False

def main():
    """Ejecutar todos los tests"""
    print("\n" + "🔍" * 30)
    print("TEST COMPLETO - PIPELINE VOCAL VOICE MOMO")
    print("🔍" * 30)
    
    results = {
        "backend_health": test_1_backend_health(),
        "config": test_4_check_env(),
    }
    
    if not results["backend_health"]:
        print("\n" + "!"*60)
        print("❌ BACKEND NO ESTÁ CORRIENDO")
        print("!"*60)
        return False
    
    token = test_2_login()
    results["login"] = token is not None
    
    if create_test_audio():
        results["voice_command"] = test_3_voice_command(token)
    else:
        results["voice_command"] = False
    
    # Resumen final
    print("\n" + "="*60)
    print("📊 RESUMEN DE RESULTADOS")
    print("="*60)
    
    for test, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test:20} {status}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 ¡TODO FUNCIONANDO! El pipeline está operativo.")
    else:
        print("\n⚠️  ALGUNOS TESTS FALLARON. Revisa los mensajes arriba.")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
