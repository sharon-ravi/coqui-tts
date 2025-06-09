import React, { useState, useEffect, useRef } from 'react';

// The WebSocket server URL remains the same
const WEBSOCKET_URL = "ws://localhost:8000/tts-stream";

function TtsPlayer() {
  const [text, setText] = useState();
  const [status, setStatus] = useState("Not Connected");
  const [audioUrl, setAudioUrl] = useState(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  
  // 1. ADD STATE TO HOLD THE REFERENCE VOICE FILE
  const [referenceFile, setReferenceFile] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    socketRef.current = new WebSocket(WEBSOCKET_URL);
    socketRef.current.binaryType = 'arraybuffer';

    socketRef.current.onopen = () => {
      console.log("WebSocket connection established.");
      setStatus("Connected. Select a voice file and enter text.");
    };

    socketRef.current.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        console.log(`Received audio data. Size: ${event.data.byteLength} bytes.`);
        const audioBlob = new Blob([event.data], { type: 'audio/wav' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setStatus("Audio ready. Playing automatically.");
        setIsSynthesizing(false);
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setStatus("Connection error. Is the backend server running?");
      setIsSynthesizing(false);
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket disconnected.");
      setStatus("Disconnected. Please refresh the page.");
      setIsSynthesizing(false);
    };

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // 2. HANDLER FOR THE FILE INPUT
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      console.log("Reference voice file selected:", file.name);
      setReferenceFile(file);
      setStatus("Voice file selected. Ready to synthesize.");
    }
  };

  // 3. UPDATE THE SYNTHESIZE HANDLER
  const handleSynthesize = () => {
    // Check for all required conditions
    if (!referenceFile) {
        setStatus("Error: Please select a reference voice file (.wav or .mp3).");
        return;
    }
    if (!text) {
        setStatus("Error: Please enter some text to synthesize.");
        return;
    }
    if (socketRef.current.readyState !== WebSocket.OPEN) {
        setStatus("Error: Not connected to the server.");
        return;
    }

    setIsSynthesizing(true);
    setStatus("Uploading voice and synthesizing... please wait.");
    setAudioUrl(null);

    // 4. SEND DATA IN TWO PARTS: JSON FIRST, THEN BINARY FILE
    // Part 1: Send metadata as a JSON string
    const metadata = {
        text: text,
        language: "en" // You can make this dynamic if you add a language selector
    };
    socketRef.current.send(JSON.stringify(metadata));

    // Part 2: Send the reference audio file as binary data
    socketRef.current.send(referenceFile);
  };

  return (
    <div className="tts-player">
      <h1>Coqui TTS Voice Cloning</h1>
      
      {/* 5. ADD THE FILE INPUT ELEMENT */}
      <div className="file-input-container">
        <label htmlFor="voice-file">1. Select Reference Voice (.wav, .mp3)</label>
        <input 
          id="voice-file"
          type="file" 
          accept="audio/wav, audio/mpeg"
          onChange={handleFileChange}
          disabled={isSynthesizing}
        />
        {referenceFile && <div className="file-name">Selected: {referenceFile.name}</div>}
      </div>

      <label htmlFor="text-input">2. Enter Text to Synthesize</label>
      <textarea
        id="text-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text here..."
        disabled={isSynthesizing}
      />
      
      <button onClick={handleSynthesize} disabled={isSynthesizing || !referenceFile}>
        {isSynthesizing ? "Working..." : "Clone Voice & Synthesize"}
      </button>

      <div className="status">
        <strong>Status:</strong> {status}
      </div>

      {audioUrl && (
        <div className="audio-container">
          <audio controls autoPlay src={audioUrl}>
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  );
}

export default TtsPlayer;