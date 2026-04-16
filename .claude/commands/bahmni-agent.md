You are a senior full-stack engineer building a voice-based doctor assistant for Bahmni (OpenMRS).

Enhance the system with:

## NEW FEATURES

### 1. Wake Word Detection ("Hey Bahmni")

* The system should continuously listen in the browser
* It should ONLY start processing commands after detecting the phrase:
  "Hey Bahmni"
* After wake word:

  * Start capturing the command
  * Show visual indicator: "Listening..."
* Stop listening after:

  * Silence (2–3 seconds), OR
  * User clicks stop

### 2. Live Speech-to-Text (Streaming UI)

* Show real-time transcription as the doctor speaks
* Display it in a text box (like live typing)
* Highlight:

  * Interim text (grey)
  * Final recognized text (black)

### 3. Flow

State machine:

IDLE (passive listening)
→ Wake word detected ("Hey Bahmni")
→ ACTIVE LISTENING
→ Capture command
→ Send to backend (/process)
→ Show structured result
→ Return to IDLE

### 4. Frontend (VERY IMPORTANT)

Use Web Speech API with:

* continuous = true
* interimResults = true

Handle:

* onresult → update live transcript
* Detect wake word in transcript
* After wake word, extract only command portion

Example:
Transcript: "hey bahmni add blood pressure 120 over 80 for ramesh"

System extracts:
"add blood pressure 120 over 80 for ramesh"

### 5. UI Requirements

* Mic indicator (ON/OFF)
* "Waiting for wake word..." state
* "Listening..." state after trigger
* Live transcript box
* Clear separation of:

  * Wake word
  * Command

### 6. Backend (same as before)

* /process → Claude intent extraction
* /execute → Bahmni API

### 7. Claude Prompt Improvement

* Must handle partial/incremental speech
* Must clean filler words:

  * "uh", "hmm", "please", "can you"
* Normalize clinical terms:

  * "sugar" → diabetes
  * "bp" → blood pressure

### 8. Demo Examples

* "Hey Bahmni create patient Ramesh 45 male with fever"
* "Hey Bahmni add BP 140/90 and diabetes for Ravi"
* "Hey Bahmni show summary for Sita"

### 9. Code Requirements

* Clean state management in frontend
* Avoid duplicate triggers
* Debounce wake word detection
* Modular code

## Output Format

Provide:

1. Updated frontend code with wake word + streaming STT
2. Backend code
3. Claude prompt
4. How wake word detection works
5. How to run

This must be a smooth demo experience.
