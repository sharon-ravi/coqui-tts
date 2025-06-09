# main.py
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from TTS.api import TTS
import torch
import soundfile as sf
import io

# --- Model Loading ---
print("Loading Coqui TTS model (this may take a moment on first run)...")
device = "cuda" if torch.cuda.is_available() else "cpu"

# Using a fast, quality model. You can experiment with others.
# e.g., "tts_models/en/ljspeech/tacotron2-DDC"
tts = TTS("tts_models/en/ljspeech/fast_pitch").to(device)
print("Coqui TTS model loaded successfully.")
# ---------------------

# --- FastAPI App ---
app = FastAPI()

# Add CORS middleware to allow requests from your React frontend
# IMPORTANT: Adjust origins if your frontend is on a different port/domain
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
            text = await websocket.receive_text()
            print(f"Received text: '{text}'")

            # --- Non-Streaming Synthesis ---
            # 1. Synthesize the entire audio clip at once.
            print("Synthesizing audio...")
            wav_samples = tts.tts(text=text)

            # 2. Convert the audio samples to WAV format bytes in memory.
            wav_buffer = io.BytesIO()
            sample_rate = tts.synthesizer.output_sample_rate
            sf.write(wav_buffer, wav_samples, sample_rate, format='WAV')
            wav_bytes = wav_buffer.getvalue()
            
            # 3. Send the entire audio clip as a single binary message.
            await websocket.send_bytes(wav_bytes)
            print("Finished sending audio data.")

    except WebSocketDisconnect:
        print("Client disconnected.")
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        print("WebSocket connection closed.")