"""
Local faster-whisper STT server for Agent Bahmni.
Replaces Chrome's cloud-based Web Speech API (blocked on hospital networks).

Usage:
  pip install -r requirements.txt
  python server.py

Endpoint: POST /transcribe
  Body: multipart/form-data with field "audio" (WebM/WAV blob from MediaRecorder)
  Optional field "language": "en", "hi" (defaults to "en")
  Returns: { "text": "transcribed text" }

Health: GET /health → { "status": "ok" }
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from faster_whisper import WhisperModel
import tempfile
import os

app = Flask(__name__)
# Allow requests from the Bahmni dev server
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://localhost", "https://127.0.0.1"])

# Load model once at startup — 'small' is fast and accurate enough for clinical use
# Change to 'medium' for better accuracy at the cost of speed
MODEL_SIZE = os.environ.get("WHISPER_MODEL", "small")
print(f"[whisper-server] Loading model '{MODEL_SIZE}'...")
model = WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")
print(f"[whisper-server] Model loaded. Listening on http://localhost:8765")


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "model": MODEL_SIZE})


@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No audio field in request"}), 400

    audio_file = request.files["audio"]
    language = request.form.get("language", "en")

    # Map browser language codes to Whisper language codes
    lang_map = {
        "en-IN": "en",
        "en-US": "en",
        "en-GB": "en",
        "hi-IN": "hi",
        "hi": "hi",
        "en": "en",
    }
    whisper_lang = lang_map.get(language, "en")

    # Write to a temp file (faster-whisper needs a file path, not a stream)
    suffix = ".webm"
    if audio_file.filename and "." in audio_file.filename:
        suffix = "." + audio_file.filename.rsplit(".", 1)[-1]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
        audio_file.save(tmp_path)

    try:
        segments, info = model.transcribe(
            tmp_path,
            language=whisper_lang,
            beam_size=5,
            vad_filter=True,           # skip silent segments
            vad_parameters={"min_silence_duration_ms": 300},
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        print(f"[whisper-server] lang={whisper_lang} → '{text}'")
        return jsonify({"text": text})
    except Exception as e:
        print(f"[whisper-server] Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(tmp_path)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8765, debug=False)
