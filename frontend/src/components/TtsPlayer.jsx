// frontend/src/components/TtsPlayer.jsx
import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';

function TtsPlayer() {
  const [text, setText] = useState();
  const [status, setStatus] = useState("Initializing...");
  const [audioHistory, setAudioHistory] = useState([]);

  useEffect(() => {
    const handleSocketMessage = (data) => {
      if (typeof data === 'string') {
        const message = JSON.parse(data);
        if (message.type === 'ping') {
            console.log("CLIENT: Received server ping.");
        }
      } else if (data instanceof ArrayBuffer) {
        const url = URL.createObjectURL(new Blob([data], { type: 'audio/wav' }));
        setAudioHistory(prev => [{ url, id: url }, ...prev]); // Add to top
      }
    };

    socketService.setOnMessageHandler(handleSocketMessage);
    socketService.connect();

    const interval = setInterval(() => {
        setStatus(socketService.isConnected() ? "Connected" : "Disconnected");
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const handleSynthesize = () => {
    if (text && socketService.isConnected()) {
      socketService.sendMessage(text);
      setText("");
    }
  };

  return (
    <div className="tts-player">
      <h1>Text to Speech</h1>
      <div className="status"><strong>Status:</strong> {status}</div>
      <div className="synthesis-section">
        <h3>Enter Text to Synthesize</h3>
        <textarea value={text} onChange={(e) => setText(e.target.value)} />
        <button onClick={handleSynthesize} disabled={status !== "Connected"}>
          Synthesize
        </button>
      </div>
      {audioHistory.length > 0 && (
        <div className="audio-container history">
          <h3>audio</h3>
          {audioHistory.map((audio) => (
            <div key={audio.id} className="history-item">
              <audio controls src={audio.url} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TtsPlayer;