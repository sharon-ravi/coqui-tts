# backend/main.py
import asyncio
import warnings
import torch
import soundfile as sf
import io
import os
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from TTS.api import TTS

warnings.filterwarnings("ignore", category=FutureWarning)

# ‼️‼️ CRITICAL: MAKE SURE THIS PATH IS CORRECT ‼️‼️
REFERENCE_VOICE_PATH = "my_voice.wav"

print("Loading Coqui XTTS v2 model...")
device = "cuda" if torch.cuda.is_available() else "cpu"
tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

if not os.path.exists(REFERENCE_VOICE_PATH):
    print(f"FATAL ERROR: Reference voice file not found at '{REFERENCE_VOICE_PATH}'")
    exit()
else:
    print(f"Using reference voice: {REFERENCE_VOICE_PATH}")

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True, 
    allow_methods=["*"], 
    allow_headers=["*"],
)


async def ping_worker(websocket: WebSocket):
    while True:
        try:
            await asyncio.sleep(15)
            await websocket.send_json({"type": "ping"})
        except (asyncio.CancelledError, WebSocketDisconnect):
            break

async def tts_worker(websocket: WebSocket, queue: asyncio.Queue):
    while True:
        try:
            text_to_speak = await queue.get()
            print(f"Worker processing: '{text_to_speak[:30]}...' (This may take a while)")

            
            wav_samples = await asyncio.to_thread(
                tts.tts,
                text=text_to_speak,
                speaker_wav=REFERENCE_VOICE_PATH,
                language="en"
            )
            
            
            print("TTS synthesis finished. Sending audio data...")
            wav_buffer = io.BytesIO()
            sf.write(wav_buffer, wav_samples, 24000, format='WAV')
            wav_bytes = wav_buffer.getvalue()

            await websocket.send_bytes(wav_bytes)
            print("Finished sending audio data.")
            queue.task_done()
        except (asyncio.CancelledError, WebSocketDisconnect):
            break
        except Exception as e:
            print(f"An error occurred in TTS worker: {e}")
            

@app.websocket("/tts-stream")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("SERVER: WebSocket connection established.")
    
    queue = asyncio.Queue()
    tts_task = asyncio.create_task(tts_worker(websocket, queue))
    ping_task = asyncio.create_task(ping_worker(websocket))

    try:
        while True:
            text = await websocket.receive_text()
            print(f"SERVER: Received text, adding to queue: '{text}'")
            await queue.put(text)
    except WebSocketDisconnect:
        print("SERVER: Client disconnected.")
    finally:
        print("SERVER: Closing background tasks...")
        tts_task.cancel()
        ping_task.cancel()
        await asyncio.gather(tts_task, ping_task, return_exceptions=True)
        print("SERVER: Connection and tasks closed.")