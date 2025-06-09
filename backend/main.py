# main.py
import warnings
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from TTS.api import TTS
import torch
import soundfile as sf
import io
import tempfile
import os

# --- Setup ---
# Suppress a specific 'FutureWarning' from PyTorch to keep the console clean.
warnings.filterwarnings("ignore", category=FutureWarning)

# --- Model Loading ---
print("Loading Coqui XTTS v2 model (this may take a few minutes on first run)...")
device = "cuda" if torch.cuda.is_available() else "cpu"

# 1. CHANGE THE MODEL TO THE XTTS v2 MODEL FOR VOICE CLONING
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

print("Coqui XTTS model loaded successfully.")
# ---------------------

# --- FastAPI App ---
app = FastAPI()

# Add CORS middleware to allow requests from your React frontend
origins = [
    "http://localhost",
    "http://localhost:5173",  # Default Vite port
    "http://localhost:3000",  # Default Create React App port
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/tts-stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("WebSocket connection established.")

    try:
        while True:
            # 2. THE NEW PROTOCOL: RECEIVE JSON METADATA, THEN AUDIO BYTES
            
            # 3. First, expect a JSON message with text and language
            metadata = await websocket.receive_json()
            text = metadata.get("text")
            language = metadata.get("language", "en") # Default to 'en' if not provided
            print(f"Received text: '{text}' in language: '{language}'")

            # 4. Second, expect the raw audio bytes for the reference voice
            reference_audio_bytes = await websocket.receive_bytes()
            print(f"Received reference audio file of size: {len(reference_audio_bytes)} bytes.")

            # 5. Save the received audio to a temporary file
            # Coqui's tts() function needs a file path for speaker_wav
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio_file:
                temp_audio_file.write(reference_audio_bytes)
                temp_audio_path = temp_audio_file.name

            try:
                # 6. Synthesize the audio using the XTTS model and the reference voice
                print(f"Cloning voice from temporary file: {temp_audio_path}")
                wav_samples = tts.tts(
                    text=text,
                    speaker_wav=temp_audio_path,
                    language=language
                )

                # 7. Convert the audio samples to WAV format bytes in memory
                wav_buffer = io.BytesIO()
                # XTTS default sample rate is 24000
                sf.write(wav_buffer, wav_samples, 24000, format='WAV')
                wav_bytes = wav_buffer.getvalue()

                # 8. Send the entire synthesized audio clip back to the client
                await websocket.send_bytes(wav_bytes)
                print("Finished sending synthesized audio data.")

            finally:
                # 9. Clean up the temporary file
                os.remove(temp_audio_path)
                print(f"Cleaned up temporary file: {temp_audio_path}")


    except WebSocketDisconnect:
        print("Client disconnected.")
    except Exception as e:
        print(f"An error occurred in the WebSocket: {e}")
    finally:
        print("WebSocket connection closed.")