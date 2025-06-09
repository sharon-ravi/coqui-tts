import React, { useState, useEffect, useRef } from 'react';

// The WebSocket server URL
const WEBSOCKET_URL = "ws://localhost:8000/tts-stream";

function TtsPlayer() {
  const [text, setText] = useState("Hello world! This is a real-time text to speech demo using React and FastAPI.");
  const [status, setStatus] = useState("Not Connected");
  const [audioUrl, setAudioUrl] = useState(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Use a ref to hold the WebSocket instance to avoid re-renders
  const socketRef = useRef(null);

  // This useEffect hook handles the WebSocket connection lifecycle
  useEffect(() => {
    // Connect to the WebSocket server
    socketRef.current = new WebSocket(WEBSOCKET_URL);
    socketRef.current.binaryType = 'arraybuffer'; // We are expecting binary audio data

    socketRef.current.onopen = () => {
      console.log("WebSocket connection established.");
      setStatus("Connected. Ready to synthesize.");
    };

    socketRef.current.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        console.log(`Received audio data. Size: ${event.data.byteLength} bytes.`);
        
        // Create a Blob from the ArrayBuffer (which is like a file in memory)
        const audioBlob = new Blob([event.data], { type: 'audio/wav' });
        
        // Create a special URL that points to our in-memory Blob
        const url = URL.createObjectURL(audioBlob);
        
        // Update state to render the new audio player
        setAudioUrl(url);
        setStatus("Audio ready. Playing automatically.");
        setIsSynthesizing(false);
      }
    };

    socketRef.current.onerror = (error) => {
      console.error("WebSocket Error:", error);
      setStatus("Connection error. Check the console for details.");
      setIsSynthesizing(false);
    };

    socketRef.current.onclose = () => {
      console.log("WebSocket disconnected.");
      setStatus("Disconnected. Please refresh the page.");
      setIsSynthesizing(false);
    };

    // Cleanup function: close the socket when the component unmounts
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []); // The empty dependency array ensures this effect runs only once on mount

  // This useEffect handles cleaning up the object URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (audioUrl) {
        console.log("Revoking old audio URL to free up memory:", audioUrl);
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]); // This effect runs whenever the audioUrl changes

  const handleSynthesize = () => {
    if (text && socketRef.current.readyState === WebSocket.OPEN) {
      setIsSynthesizing(true);
      setStatus("Synthesizing... please wait.");
      setAudioUrl(null); // Clear previous audio player
      socketRef.current.send(text);
    } else {
      setStatus("Cannot synthesize. Please enter text and ensure you are connected.");
    }
  };

  return (
    <div className="tts-player">
      <h1>React & FastAPI TTS</h1>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter text here..."
        disabled={isSynthesizing}
      />
      <button onClick={handleSynthesize} disabled={isSynthesizing}>
        {isSynthesizing ? "Working..." : "Synthesize Audio"}
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