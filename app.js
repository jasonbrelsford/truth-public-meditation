const sessionLength = document.getElementById("session-length");
const sessionLengthValue = document.getElementById("session-length-value");
const startSessionBtn = document.getElementById("start-session");
const toggleToneBtn = document.getElementById("toggle-tone");
const startBreathBtn = document.getElementById("start-breath");
const breathState = document.getElementById("breath-state");
const breathFill = document.getElementById("breath-fill");
const intentionInput = document.getElementById("intention");
const sensitivityInput = document.getElementById("sensitivity");
const frequencyInput = document.getElementById("frequency");
const beatDepthInput = document.getElementById("beat-depth");
const volumeInput = document.getElementById("volume");
const audioModeSelect = document.getElementById("audio-mode");
const spiritMessageInput = document.getElementById("spirit-message");
const spiritModInput = document.getElementById("spirit-mod");
const spiritUseAi = document.getElementById("spirit-use-ai");
const speakSpiritBtn = document.getElementById("speak-spirit");
const aiListenBtn = document.getElementById("ai-listen");
const aiSendBtn = document.getElementById("ai-send");
const aiTranscript = document.getElementById("ai-transcript");
const aiStatus = document.getElementById("ai-status");
const aiResponse = document.getElementById("ai-response");
const voiceSelect = document.getElementById("voice-select");
const statusAi = document.getElementById("status-ai");
const statusLast = document.getElementById("status-last");
const statusError = document.getElementById("status-error");
const signalFill = document.getElementById("signal-fill");
const promptText = document.getElementById("prompt");
const promptBtn = document.getElementById("new-prompt");
const feedbackForm = document.getElementById("feedback-form");
const formStatus = document.getElementById("form-status");
const veilStage = document.getElementById("veil-3d");
const fullscreenBtn = document.getElementById("toggle-fullscreen");
const voiceUnlock = document.getElementById("voice-unlock");

const AI_ENDPOINT = window.AI_ENDPOINT || "http://localhost:8787/api/suggest";
const AI_BASE_URL = (() => {
  try {
    return new URL(AI_ENDPOINT, window.location.href).origin;
  } catch (error) {
    return "http://localhost:8787";
  }
})();

const prompts = [
  "What memory brings you peace right now?",
  "Who would you like to send gratitude to?",
  "What message might you want to hear from beyond the veil?",
  "What are you ready to forgive today?",
  "Where do you feel connected in your body?",
];

let breathTimer = null;
let audioContext = null;
let oscillatorLeft = null;
let oscillatorRight = null;
let gainNode = null;
let leftPan = null;
let rightPan = null;
let audioUpdateTimer = null;
let ambientWanted = false;
let audioState = {
  drift: 0,
  breath: 0,
  beat: 0,
};
let breathGuide = {
  active: false,
  phaseIndex: 0,
  phaseStart: 0,
  preDelayMs: 3000,
  phases: [
    { label: "Breathe in", duration: 4 },
    { label: "Hold", duration: 4 },
    { label: "Breathe out", duration: 6 },
  ],
};
let three = {
  renderer: null,
  scene: null,
  camera: null,
  particles: null,
  particlePositions: null,
  particleVelocities: null,
  particleBaseVelocities: null,
  veilPlanes: [],
  centralGlow: null,
};
let veilRunning = false;
let startTime = performance.now();
let selectedVoice = null;
let selectedAiVoice = null;
let overrideColor = null;
let orbPulseMs = 120000;
let aiListening = false;
let lastAiAt = null;
let lastUserLang = navigator.language || "en-US";
let aiReplyTimer = null;
let autoListen = true;
let recognitionInstance = null;
let meditationTimer = null;
let meditationQueue = [];
let meditationActive = false;
let meditationStartAt = Date.now() + 30000;
let meditationInterrupted = false;
let meditationResumeTimer = null;
let meditationPaused = false;
let meditationPauseCheckTimer = null;
let wakeLock = null;
let experienceStarted = false;
let prepSpoken = false;
let awaitingMeditationConsent = false;
let meditationConsent = null;
let voiceUnlocked = false;
let manualVoiceName = "";

document.body.classList.add("prelude");

sessionLength.addEventListener("input", () => {
  sessionLengthValue.textContent = `${sessionLength.value} min`;
});

startSessionBtn.addEventListener("click", () => {
  startSessionBtn.textContent = "Session Running";
  startSessionBtn.disabled = true;
  setTimeout(() => {
    startSessionBtn.textContent = "Begin Session";
    startSessionBtn.disabled = false;
  }, Number(sessionLength.value) * 1000 * 60);
});

function ensureAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0.001;
    gainNode.connect(audioContext.destination);
  }

  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }

  if (!oscillatorLeft || !oscillatorRight) {
    oscillatorLeft = audioContext.createOscillator();
    oscillatorRight = audioContext.createOscillator();
    leftPan = audioContext.createStereoPanner();
    rightPan = audioContext.createStereoPanner();
    leftPan.pan.value = -0.8;
    rightPan.pan.value = 0.8;

    oscillatorLeft.type = "sine";
    oscillatorRight.type = "sine";

    oscillatorLeft.connect(leftPan).connect(gainNode);
    oscillatorRight.connect(rightPan).connect(gainNode);

    oscillatorLeft.start();
    oscillatorRight.start();
  }
}

function startAudioUpdates() {
  if (audioUpdateTimer) return;
  audioUpdateTimer = setInterval(() => {
    if (!audioContext) return;
    updateAudio(audioContext.currentTime * 1000);
  }, 120);
}

function stopAudioUpdates() {
  if (!audioUpdateTimer) return;
  clearInterval(audioUpdateTimer);
  audioUpdateTimer = null;
}

function rampVolume(target, duration = 1.4) {
  if (!gainNode || !audioContext) return;
  const now = audioContext.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(target, now + duration);
}

function startTone() {
  ensureAudio();
  ambientWanted = true;
  toggleToneBtn.textContent = "Stop Ambient Audio";
  rampVolume(Number(volumeInput.value) / 100, 1.8);
  startAudioUpdates();
}

function stopTone() {
  ambientWanted = false;
  if (gainNode && audioContext) {
    rampVolume(0.0001, 0.6);
    setTimeout(() => {
      if (oscillatorLeft) oscillatorLeft.stop();
      if (oscillatorRight) oscillatorRight.stop();
      if (audioContext) audioContext.close();

      oscillatorLeft = null;
      oscillatorRight = null;
      audioContext = null;
      gainNode = null;
    }, 700);
  }
  stopAudioUpdates();
  toggleToneBtn.textContent = "Start Ambient Audio";
}

toggleToneBtn.addEventListener("click", () => {
  if (audioContext) {
    stopTone();
  } else {
    startTone();
    startBreathGuide();
  }
});

function autoStartAudio() {
  startExperience();
}

["pointerdown", "keydown"].forEach((eventName) => {
  window.addEventListener(eventName, autoStartAudio, { once: true });
});

volumeInput.addEventListener("input", () => {
  if (gainNode) gainNode.gain.value = Number(volumeInput.value) / 100;
});

startBreathBtn.addEventListener("click", () => {
  if (breathTimer) {
    clearInterval(breathTimer);
    breathTimer = null;
    breathState.textContent = "Paused";
    breathFill.style.width = "0%";
    startBreathBtn.textContent = "Start Breath Cycle";
    return;
  }

  const phases = [
    { label: "Inhale", duration: 4 },
    { label: "Hold", duration: 4 },
    { label: "Exhale", duration: 6 },
  ];
  let phaseIndex = 0;
  let remaining = phases[0].duration;
  startBreathBtn.textContent = "Pause Breath Cycle";

  breathState.textContent = `${phases[0].label} - ${remaining}`;

  breathTimer = setInterval(() => {
    remaining -= 1;
    breathState.textContent = `${phases[phaseIndex].label} - ${remaining}`;
    const progress = 1 - remaining / phases[phaseIndex].duration;
    breathFill.style.width = `${Math.max(progress, 0) * 100}%`;

    if (remaining <= 0) {
      phaseIndex = (phaseIndex + 1) % phases.length;
      remaining = phases[phaseIndex].duration;
    }
  }, 1000);
});

promptBtn.addEventListener("click", () => {
  const next = prompts[Math.floor(Math.random() * prompts.length)];
  promptText.textContent = next;
});

feedbackForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = document.getElementById("name").value.trim();
  const feedback = document.getElementById("feedback").value.trim();
  if (!feedback) return;
  const entry = {
    name: name || "Anonymous",
    feedback,
    createdAt: new Date().toISOString(),
  };
  const existing = JSON.parse(localStorage.getItem("truth-feedback") || "[]");
  existing.push(entry);
  localStorage.setItem("truth-feedback", JSON.stringify(existing));
  formStatus.textContent = "Thank you. Your feedback is saved on this device.";
  feedbackForm.reset();
});

function setFullscreenState(isActive) {
  veilStage.classList.toggle("fullscreen", isActive);
  document.body.classList.toggle("fullscreen-active", isActive);
  fullscreenBtn.textContent = isActive ? "Exit Full Screen" : "Full Screen";
  resizeThree();
}

fullscreenBtn.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  if (veilStage.requestFullscreen) {
    veilStage.requestFullscreen();
  } else {
    setFullscreenState(!veilStage.classList.contains("fullscreen"));
  }
});

document.addEventListener("fullscreenchange", () => {
  setFullscreenState(Boolean(document.fullscreenElement));
});

function normalizeHexColor(value) {
  if (!value) return null;
  const trimmed = String(value).trim();
  const match = trimmed.match(/^#?[0-9a-fA-F]{6}$/);
  if (!match) return null;
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

function pickVoiceForLang(lang, preferredTokens = []) {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const normalized = (lang || "").toLowerCase();
  const base = normalized.split("-")[0];
  const tokens = preferredTokens.map((token) => token.toLowerCase());
  const femaleTokens = [
    "female",
    "woman",
    "samantha",
    "victoria",
    "tessa",
    "moira",
    "siri",
    "karen",
    "susan",
  ];
  const avoidTokens = ["male", "man", "alex", "daniel", "fred"];

  let best = null;
  let bestScore = -1;
  voices.forEach((voice) => {
    const name = `${voice.name} ${voice.lang}`.toLowerCase();
    if (avoidTokens.some((token) => name.includes(token))) return;
    let score = 0;
    if (normalized && voice.lang.toLowerCase().startsWith(normalized)) score += 3;
    else if (base && voice.lang.toLowerCase().startsWith(base)) score += 2;
    tokens.forEach((token) => {
      if (name.includes(token)) score += 2;
    });
    femaleTokens.forEach((token) => {
      if (name.includes(token)) score += 1;
    });
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  });

  return best || voices[0];
}

function getAllVoices() {
  if (!window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

function populateVoiceSelect() {
  if (!voiceSelect) return;
  const voices = getAllVoices();
  if (!voices.length) return;
  const current = manualVoiceName || voiceSelect.value;
  voiceSelect.innerHTML = "<option value=\"\">Auto</option>";
  voices.forEach((voice) => {
    const option = document.createElement("option");
    option.value = voice.name;
    option.textContent = `${voice.name} (${voice.lang})`;
    voiceSelect.appendChild(option);
  });
  if (current) {
    voiceSelect.value = current;
    manualVoiceName = current;
  }
}

function getManualVoice() {
  if (!manualVoiceName) return null;
  const voices = getAllVoices();
  return voices.find((voice) => voice.name === manualVoiceName) || null;
}

function pickAiVoice(lang) {
  const manual = getManualVoice();
  if (manual) return manual;
  const normalized = (lang || "").toLowerCase();
  if (normalized.startsWith("en")) {
    return pickVoiceForLang("en-IN", ["en-in", "india", "indian", "hindi", "female", "siri"]);
  }
  return pickVoiceForLang(lang, ["female", "siri"]);
}

function getBaseColor() {
  if (overrideColor) {
    return new THREE.Color(overrideColor);
  }
  return colorFromIntention(intentionInput.value.trim());
}

function applyAiSuggestion(payload) {
  if (!payload || typeof payload !== "object") return;

  if (payload.intention && typeof payload.intention === "string") {
    intentionInput.value = payload.intention.trim();
  }

  if (payload.color) {
    const normalized = normalizeHexColor(payload.color);
    if (normalized) overrideColor = normalized;
  }

  if (payload.pulseSeconds) {
    const value = Number(payload.pulseSeconds);
    if (Number.isFinite(value)) {
      orbPulseMs = clamp(value * 1000, 20000, 300000);
    }
  }

  if (payload.frequencyHz) {
    const value = Number(payload.frequencyHz);
    if (Number.isFinite(value)) {
      frequencyInput.value = String(clamp(value, 40, 528));
    }
  }

  if (payload.beatDepthHz) {
    const value = Number(payload.beatDepthHz);
    if (Number.isFinite(value)) {
      beatDepthInput.value = String(clamp(value, 1, 12));
    }
  }

  if (payload.volume) {
    const value = Number(payload.volume);
    if (Number.isFinite(value)) {
      const volumePercent = clamp(value, 0.05, 1) * 100;
      volumeInput.value = String(Math.round(volumePercent));
      if (gainNode) gainNode.gain.value = volumePercent / 100;
    }
  }

  if (payload.mode && typeof payload.mode === "string") {
    const mode = payload.mode.toLowerCase();
    if (["binaural", "drift", "breath"].includes(mode)) {
      audioModeSelect.value = mode;
    }
  }

  const fallbackReplies = [
    "I hear you.",
    "Yes, I am here.",
    "Your words are received.",
    "Thank you for sharing that.",
    "I am listening.",
  ];
  const replyText =
    payload.reply && typeof payload.reply === "string" && payload.reply.trim()
      ? payload.reply.trim()
      : fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
  if (aiResponse) aiResponse.textContent = replyText;
  if (aiReplyTimer) {
    clearTimeout(aiReplyTimer);
  }
  speak(replyText, getAiVoiceSettings());

  lastAiAt = new Date();
  if (statusLast) {
    statusLast.textContent = lastAiAt.toLocaleTimeString();
  }
}

async function requestAiGuidance(text) {
  if (!text) {
    if (aiStatus) aiStatus.textContent = "Add a message to send.";
    return;
  }

  if (aiStatus) aiStatus.textContent = "Connecting to AI...";

  try {
    const response = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript: text,
        intention: intentionInput.value.trim(),
      }),
    });

    if (!response.ok) {
      throw new Error(`AI request failed (${response.status})`);
    }

    const data = await response.json();
    applyAiSuggestion(data);

    if (aiStatus) aiStatus.textContent = "Applied AI tuning.";
  } catch (error) {
    if (aiStatus) aiStatus.textContent = "AI connection failed. Check the local server.";
    if (statusError) statusError.textContent = "AI request failed";
    if (statusError) statusError.classList.add("status-bad");
    if (statusError) statusError.classList.remove("status-ok");
  }
}

async function pollAiHealth() {
  if (!statusAi) return;
  try {
    const response = await fetch(`${AI_BASE_URL}/api/health`, { cache: "no-store" });
    if (!response.ok) throw new Error("Health check failed");
    const data = await response.json();
    statusAi.textContent = data.status === "ok" ? "Online" : "Degraded";
    statusAi.classList.toggle("status-ok", data.status === "ok");
    statusAi.classList.toggle("status-bad", data.status !== "ok");
    if (data.status === "ok" && statusError) {
      statusError.textContent = "None";
      statusError.classList.remove("status-bad");
      statusError.classList.add("status-ok");
    }
  } catch (error) {
    statusAi.textContent = "Offline";
    statusAi.classList.remove("status-ok");
    statusAi.classList.add("status-bad");
    if (statusError) {
      statusError.textContent = "AI proxy unreachable";
      statusError.classList.add("status-bad");
      statusError.classList.remove("status-ok");
    }
  }
}

function setupSpeechRecognition() {
  if (!aiListenBtn && !aiSendBtn) return;

  if (aiSendBtn) {
    aiSendBtn.addEventListener("click", () => {
      if (!aiTranscript) return;
      requestAiGuidance(aiTranscript.value.trim());
    });
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    if (aiStatus) aiStatus.textContent = "Speech recognition not available in this browser.";
    if (aiListenBtn) aiListenBtn.disabled = true;
    return;
  }

  if (!aiListenBtn) return;

  const recognition = new SpeechRecognition();
  recognitionInstance = recognition;
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    aiListening = true;
    aiListenBtn.textContent = "I'm Listening";
    aiListenBtn.classList.add("listening");
    if (aiStatus) aiStatus.textContent = "Listening for your prompt...";
  };

  recognition.onend = () => {
    aiListening = false;
    aiListenBtn.textContent = "I'm Listening";
    aiListenBtn.classList.remove("listening");
    if (autoListen) {
      try {
        recognition.start();
      } catch (error) {
        // Ignore if restart is blocked.
      }
    }
  };

  recognition.onerror = () => {
    if (aiStatus) aiStatus.textContent = "Voice capture failed. Try again.";
  };

  recognition.onresult = (event) => {
    const result = event.results[0][0].transcript;
    if (aiTranscript) aiTranscript.value = result;
    lastUserLang = recognition.lang || navigator.language || "en-US";
    selectedAiVoice = pickAiVoice(lastUserLang);
    const normalized = result.toLowerCase();
    const pauseTokens = ["pause", "stop", "hold on", "wait", "please stop"];
    const resumeTokens = ["continue", "resume", "yes", "ready", "go on"];
    if (pauseTokens.some((token) => normalized.includes(token))) {
      pauseMeditation();
      return;
    }
    if (meditationPaused && resumeTokens.some((token) => normalized.includes(token))) {
      resumeMeditation();
      return;
    }
    handleMeditationInterrupt();
    if (awaitingMeditationConsent) {
      const yesTokens = ["yes", "yeah", "yep", "sure", "ok", "okay", "begin", "start", "ready"];
      const noTokens = ["no", "not now", "later", "stop", "no thanks", "dont", "don't"];
      const isYes = yesTokens.some((token) => normalized.includes(token));
      const isNo = noTokens.some((token) => normalized.includes(token));
      if (isYes) {
        awaitingMeditationConsent = false;
        meditationConsent = true;
        speak("Thank you. We will begin shortly.", getAiVoiceSettings());
        scheduleMeditation(30000);
        return;
      }
      if (isNo) {
        awaitingMeditationConsent = false;
        meditationConsent = false;
        speak("Of course. I will stay with you and guide gently.", getAiVoiceSettings());
        return;
      }
    }
    requestAiGuidance(result);
  };

  aiListenBtn.addEventListener("click", () => {
    if (aiListening) return;
    recognition.start();
  });
}

function pickVoice() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const preferred = ["zira", "samantha", "victoria", "female", "english"];
  const match = voices.find((voice) => {
    const name = `${voice.name} ${voice.lang}`.toLowerCase();
    return preferred.some((token) => name.includes(token));
  });
  return match || voices[0];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getSpiritVoiceSettings() {
  if (!spiritModInput) return {};
  const mod = Number(spiritModInput.value) / 100;
  const wobble = (Math.random() - 0.5) * 0.2 * mod;
  const rate = clamp(0.75 + mod * 0.35 + wobble, 0.6, 1.3);
  const pitch = clamp(0.9 + mod * 0.7 + wobble, 0.7, 1.6);
  const volume = clamp(0.25 + mod * 0.35, 0.1, 0.7);
  return { rate, pitch, volume };
}

function getAiVoiceSettings() {
  return {
    rate: 0.72,
    pitch: 1.05,
    volume: 0.35,
    voice: selectedAiVoice || pickAiVoice(lastUserLang),
  };
}

function speak(text, settings = {}) {
  if (!window.speechSynthesis) return;
  if (!selectedVoice) selectedVoice = pickVoice();
  const voice = settings.voice || selectedVoice;
  if (!voice) return;
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
  const preservedVolume = gainNode ? gainNode.gain.value : null;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.rate = settings.rate ?? 0.7;
  utterance.pitch = settings.pitch ?? 1.1;
  utterance.volume = settings.volume ?? 0.22;
  utterance.onstart = () => {
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    if (gainNode && preservedVolume !== null && audioContext) {
      const ducked = Math.max(preservedVolume * 0.85, 0.02);
      gainNode.gain.setTargetAtTime(ducked, audioContext.currentTime, 0.05);
    }
  };
  utterance.onend = () => {
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume().catch(() => {});
    }
    if (gainNode && preservedVolume !== null) {
      gainNode.gain.setTargetAtTime(preservedVolume, audioContext.currentTime, 0.08);
    }
    if (ambientWanted) {
      ensureAudio();
      rampVolume(Number(volumeInput.value) / 100, 0.6);
    }
  };
  utterance.onerror = utterance.onend;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function setupVoiceUnlock() {
  if (!voiceUnlock) return;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
  if (!isIOS || !window.speechSynthesis) return;

  voiceUnlock.style.display = "flex";
  const unlock = () => {
    if (voiceUnlocked) return;
    voiceUnlocked = true;
    voiceUnlock.style.display = "none";
    const utterance = new SpeechSynthesisUtterance("Voice enabled.");
    utterance.volume = 0.01;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  voiceUnlock.addEventListener("click", unlock, { once: true });
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    selectedVoice = pickVoice();
    selectedAiVoice = pickAiVoice(lastUserLang);
    populateVoiceSelect();
  };
}

if (voiceSelect) {
  voiceSelect.addEventListener("change", () => {
    manualVoiceName = voiceSelect.value;
    selectedAiVoice = pickAiVoice(lastUserLang);
  });
  populateVoiceSelect();
}

if (speakSpiritBtn) {
  speakSpiritBtn.addEventListener("click", () => {
    const text = spiritMessageInput.value.trim();
    const useAiVoice = spiritUseAi && spiritUseAi.value === "ai";
    const settings = useAiVoice ? getAiVoiceSettings() : getSpiritVoiceSettings();
    if (!text) {
      speak("The channel is open.", settings);
      return;
    }
    speak(text, settings);
  });
}

function startMeditationGuide() {
  if (meditationActive) return;
  if (meditationConsent === false) return;
  meditationActive = true;
  meditationInterrupted = false;
  requestWakeLock();
  const script = [
    "Find a position where your spine is supported but relaxed. Eyes closed. Hands resting easily. If this meditation is interupted just indicate with your voice that you are ready to continue.",
    "Give your intention to be open to spirit and those that have crossed.",
    "Give your intention to help anyone or anything here that needs you for messages from the other side.",
    "Begin with slow breathing. Inhale through the nose to a count of four. Exhale through the mouth to a count of six.",
    "Do this several times. . . . . . . . . . . . . . . . .",
    "Nothing to achieve. Nothing to force.",
    "With each exhale, imagine tension leaving the body.",
    "First the forehead..",
    "Then the jaw. .",
    "The shoulders..",
    "The chest..",
    "The abdomen..",
    "The legs..",
    "The feet..",
    "Your body becomes still. heavy. safe.",
    "Now imagine yourself surrounded by a soft, neutral light. . . .",
    "Not bright.. .",
    "Not symbolic..",
    "Just present.",
    "This light does nothing except protect and calm.",
    "I am safe. I am guided. I am open only to what is helpful. I am open to spirit and please feel free to work through me spirit.",
    "In this quiet space, bring attention inward to the center of the chest or the space just behind the eyes.",
    "You are not asking for visions. You are not trying to see anything. Instead, simply allow awareness.",
    "If an image, word, memory, or feeling arises, you notice it calmly. If nothing arises, that is perfectly fine.",
    "The connection often comes as a feeling of knowing, not imagery.",
    "Repeat this in your minds eye.",
    "If there is guidance for me now, I am open to receive it.",
    "Then remain still for a minute or two. . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .",
    "Receiving without interpreting. If something comes, do not analyze it. Do not judge it. Do not assign meaning yet. Just observe.",
    "If nothing comes, you are still doing it correctly. The nervous system is learning stillness. That is the work.",
    "When ready, gently bring attention back to the breath.",
    "Feel the body again. Feet. Legs. Hands. Shoulders.",
    "Count slowly from one to five. At five, open your eyes.",
    "You return clear, grounded, and intact.",
  ];
  meditationQueue = script.slice();
  playMeditationStep();
}

function scheduleMeditation(delayMs = 30000) {
  if (meditationTimer) clearTimeout(meditationTimer);
  meditationStartAt = Date.now() + delayMs;
  meditationTimer = setTimeout(() => {
    startMeditationGuide();
  }, delayMs);
}

function startExperience() {
  if (experienceStarted) return;
  experienceStarted = true;
  document.body.classList.remove("prelude");
  startTone();
  startBreathGuide();
  if (!prepSpoken && !meditationActive) {
    prepSpoken = true;
    awaitingMeditationConsent = true;
    speak(
      "Would you like to hear a guided meditation? If so, please say yes to begin.",
      getAiVoiceSettings()
    );
  }
  requestWakeLock();
}

function playMeditationStep() {
  if (!meditationQueue.length) {
    meditationActive = false;
    return;
  }
  if (meditationInterrupted || meditationPaused) return;
  const line = meditationQueue.shift();
  const lineTrimmed = line.trim();
  const hasPeriod = lineTrimmed.includes(".");
  const hasColon = lineTrimmed.includes(":");
  let pauseMs = 2000;
  if (hasColon) pauseMs = Math.max(pauseMs, 5000);
  if (hasPeriod) pauseMs = Math.max(pauseMs, 10000);
  const settings = getAiVoiceSettings();
  const utterance = new SpeechSynthesisUtterance(line);
  utterance.voice = settings.voice || selectedVoice;
  utterance.rate = settings.rate ?? 0.7;
  utterance.pitch = settings.pitch ?? 1.1;
  utterance.volume = settings.volume ?? 0.22;
  utterance.onend = () => {
    setTimeout(playMeditationStep, pauseMs);
  };
  utterance.onerror = () => {
    setTimeout(playMeditationStep, pauseMs);
  };
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function handleMeditationInterrupt() {
  if (!meditationActive) return;
  meditationInterrupted = true;
  window.speechSynthesis.cancel();
  if (meditationResumeTimer) clearTimeout(meditationResumeTimer);
  meditationResumeTimer = setTimeout(() => {
    meditationInterrupted = false;
    speak("I am ready to continue.", getAiVoiceSettings());
    setTimeout(() => {
      playMeditationStep();
    }, 1200);
  }, 5000);
}

function pauseMeditation() {
  if (!meditationActive) return;
  meditationPaused = true;
  window.speechSynthesis.cancel();
  if (meditationPauseCheckTimer) clearTimeout(meditationPauseCheckTimer);
  meditationPauseCheckTimer = setTimeout(() => {
    if (!meditationPaused) return;
    speak("Would you like to continue the meditation?", getAiVoiceSettings());
  }, 120000);
}

function resumeMeditation() {
  if (!meditationPaused) return;
  meditationPaused = false;
  if (meditationPauseCheckTimer) {
    clearTimeout(meditationPauseCheckTimer);
    meditationPauseCheckTimer = null;
  }
  speak("Thank you. We will continue now.", getAiVoiceSettings());
  setTimeout(() => {
    playMeditationStep();
  }, 1200);
}

async function requestWakeLock() {
  if (!("wakeLock" in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
  } catch (error) {
    // Ignore if wake lock is not permitted.
  }
}

async function releaseWakeLock() {
  if (!wakeLock) return;
  try {
    await wakeLock.release();
  } catch (error) {
    // Ignore errors on release.
  } finally {
    wakeLock = null;
  }
}

setupSpeechRecognition();
setupVoiceUnlock();
if (recognitionInstance) {
  try {
    recognitionInstance.start();
  } catch (error) {
    // Ignore if the browser blocks autoplay.
  }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    requestWakeLock();
    return;
  }
  handleMeditationInterrupt();
});
["pointerdown", "keydown"].forEach((eventName) => {
  window.addEventListener(
    eventName,
    () => {
      startExperience();
      if (!recognitionInstance || aiListening) return;
      try {
        recognitionInstance.start();
      } catch (error) {
        // Ignore if start is blocked by the browser.
      }
      if (!meditationActive && Date.now() >= meditationStartAt) {
        startMeditationGuide();
      }
      requestWakeLock();
    },
    { once: true }
  );
});
setInterval(pollAiHealth, 4000);
pollAiHealth();
setInterval(() => {
  if (!ambientWanted) return;
  const missingOscillators = !oscillatorLeft || !oscillatorRight;
  const closedContext = !audioContext || audioContext.state === "closed";
  if (missingOscillators || closedContext || audioContext.state === "suspended") {
    ensureAudio();
    rampVolume(Number(volumeInput.value) / 100, 0.6);
  }
}, 10000);

function startBreathGuide() {
  if (breathGuide.active) return;
  breathGuide.active = true;
  breathGuide.phaseIndex = 0;
  breathGuide.phaseStart = performance.now() + breathGuide.preDelayMs;
}

function makeGradientTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(128, 128, 20, 128, 128, 128);
  gradient.addColorStop(0, "rgba(247, 200, 141, 0.75)");
  gradient.addColorStop(0.5, "rgba(139, 196, 229, 0.3)");
  gradient.addColorStop(1, "rgba(10, 11, 19, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(canvas);
}

function colorFromIntention(text) {
  if (!text) return new THREE.Color("#f7c88d");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return new THREE.Color(`hsl(${hue}, 65%, 65%)`);
}

function initThree() {
  if (!window.THREE || three.renderer) return;

  three.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  three.renderer.setPixelRatio(window.devicePixelRatio || 1);
  three.renderer.setSize(veilStage.clientWidth, veilStage.clientHeight);
  three.renderer.setClearColor(0x0b0a12, 0);
  veilStage.appendChild(three.renderer.domElement);

  three.scene = new THREE.Scene();
  three.scene.fog = new THREE.FogExp2(0x0f0f1a, 0.09);

  three.camera = new THREE.PerspectiveCamera(
    45,
    veilStage.clientWidth / veilStage.clientHeight,
    0.1,
    100
  );
  three.camera.position.set(0, 0, 6);

  const ambient = new THREE.AmbientLight(0xf2e7d7, 0.6);
  const directional = new THREE.DirectionalLight(0x9ad1f5, 0.6);
  directional.position.set(2, 2, 4);
  three.scene.add(ambient, directional);

  const texture = makeGradientTexture();
  for (let i = 0; i < 3; i += 1) {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 3.2, 48, 24),
      new THREE.MeshStandardMaterial({
        map: texture,
        transparent: true,
        opacity: 0.4,
        roughness: 0.6,
        metalness: 0.1,
        emissive: new THREE.Color(0x2b2a3d),
        emissiveIntensity: 0.25,
        side: THREE.DoubleSide,
      })
    );
    plane.position.z = -1.6 - i * 0.9;
    plane.rotation.z = i * 0.2;
    three.scene.add(plane);
    three.veilPlanes.push(plane);
  }

  three.centralGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: texture,
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  three.centralGlow.scale.set(2.2, 1.2, 1);
  three.centralGlow.position.set(0, 0, 0.2);
  three.scene.add(three.centralGlow);

  const particleCount = 1600;
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i += 1) {
    positions[i * 3] = (Math.random() - 0.5) * 8;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 6;

    velocities[i * 3] = (Math.random() - 0.5) * 0.0012;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.0012;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.0012;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xe6f4ff,
    size: 0.02,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.9,
  });

  three.particles = new THREE.Points(geometry, material);
  three.scene.add(three.particles);
  three.particlePositions = positions;
  three.particleVelocities = velocities;
  three.particleBaseVelocities = new Float32Array(velocities);

  veilRunning = true;
  animateThree();
}

function resizeThree() {
  if (!three.renderer || !three.camera) return;
  const width = veilStage.clientWidth;
  const height = veilStage.clientHeight;
  three.renderer.setSize(width, height);
  three.camera.aspect = width / height;
  three.camera.updateProjectionMatrix();
}

function updateAudio(time) {
  if (!audioContext || !oscillatorLeft || !oscillatorRight) return;

  const mode = audioModeSelect.value;
  const base = Number(frequencyInput.value);
  const beatDepth = Number(beatDepthInput.value);
  const sensitivity = Number(sensitivityInput.value) / 100;

  const drift = Math.sin(time * 0.00018) * (6 + sensitivity * 8);
  const breathWave = Math.sin(time * 0.0005) * (4 + sensitivity * 6);
  let leftFreq = base + drift;
  let rightFreq = base + drift;
  let beat = 0;

  if (mode === "binaural") {
    beat = beatDepth;
    leftFreq = base + drift - beatDepth / 2;
    rightFreq = base + drift + beatDepth / 2;
  } else if (mode === "breath") {
    beat = beatDepth;
    leftFreq = base + breathWave - beatDepth / 2;
    rightFreq = base + breathWave + beatDepth / 2;
  }

  audioState = {
    drift,
    breath: breathWave,
    beat,
  };

  const now = audioContext.currentTime;
  oscillatorLeft.frequency.setTargetAtTime(leftFreq, now, 0.08);
  oscillatorRight.frequency.setTargetAtTime(rightFreq, now, 0.08);
}

function updateBreathGuide(time) {
  if (!breathGuide.active || time < breathGuide.phaseStart) return null;
  const phase = breathGuide.phases[breathGuide.phaseIndex];
  const elapsed = (time - breathGuide.phaseStart) / 1000;
  if (elapsed >= phase.duration) {
    breathGuide.phaseIndex = (breathGuide.phaseIndex + 1) % breathGuide.phases.length;
    breathGuide.phaseStart = time;
    return 0;
  }
  return elapsed / phase.duration;
}

function animateThree() {
  if (!veilRunning) return;
  const time = performance.now() - startTime;

  const baseColor = getBaseColor();
  if (three.particles && three.particles.material) {
    three.particles.material.color = baseColor.clone().lerp(new THREE.Color("#8bc4e5"), 0.4);
  }

  const parallaxX = Math.sin(time * 0.00012) * 0.08;
  const parallaxY = Math.cos(time * 0.0001) * 0.05;
  if (three.camera) {
    three.camera.position.x = parallaxX;
    three.camera.position.y = parallaxY;
    three.camera.lookAt(0, 0, 0);
  }

  const frequency = Number(frequencyInput.value);
  const freqNorm = Math.min(Math.max((frequency - 40) / 488, 0), 1);
  const audioEnergy = Math.abs(audioState.drift) + Math.abs(audioState.breath) + audioState.beat;
  const speedScale = 0.5 + freqNorm * 0.8 + audioEnergy * 0.02;

  const positions = three.particlePositions;
  const baseVelocities = three.particleBaseVelocities;
  const velocities = three.particleVelocities;
  for (let i = 0; i < positions.length; i += 3) {
    velocities[i] = baseVelocities[i] * speedScale;
    velocities[i + 1] = baseVelocities[i + 1] * speedScale;
    velocities[i + 2] = baseVelocities[i + 2] * speedScale;

    positions[i] += velocities[i];
    positions[i + 1] += velocities[i + 1];
    positions[i + 2] += velocities[i + 2];

    const radius = Math.sqrt(positions[i] ** 2 + positions[i + 1] ** 2);
    if (radius < 0.8) {
      positions[i] -= positions[i] * 0.01 * speedScale;
      positions[i + 1] -= positions[i + 1] * 0.01 * speedScale;
      positions[i + 2] -= 0.04 * speedScale;
    }

    if (positions[i] > 4 || positions[i] < -4) baseVelocities[i] *= -1;
    if (positions[i + 1] > 2 || positions[i + 1] < -2) baseVelocities[i + 1] *= -1;
    if (positions[i + 2] > 3 || positions[i + 2] < -3) baseVelocities[i + 2] *= -1;
  }
  if (three.particles && three.particles.geometry) {
    three.particles.geometry.attributes.position.needsUpdate = true;
  }

  if (three.particles) {
    const swirl = 0.00015 + freqNorm * 0.0003;
    three.particles.rotation.z += swirl;
    three.particles.rotation.x = Math.sin(time * 0.00008) * 0.015;
    if (three.particles.material) {
      const twinkle = 0.017 + (Math.sin(time * 0.0012) + 1) * 0.003;
      three.particles.material.size = twinkle;
    }
  }

  three.veilPlanes.forEach((plane, index) => {
    plane.rotation.z += (0.0006 + index * 0.0003) * speedScale;
    plane.rotation.x = Math.sin(time * 0.0006 + index) * 0.1;
    plane.material.color = baseColor;
    plane.material.opacity = 0.35 + freqNorm * 0.2;
  });

  if (three.scene && three.scene.fog) {
    three.scene.fog.density = 0.08 + freqNorm * 0.03 + audioEnergy * 0.002;
  }

  if (three.centralGlow) {
    const breathProgress = updateBreathGuide(time + startTime);
    const inhale = breathProgress !== null ? Math.sin(breathProgress * Math.PI) : 0;
    const slowWave = 0.5 - 0.5 * Math.cos((time / orbPulseMs) * Math.PI * 2);
    const slowPulse = 0.6 + slowWave * 1.0;
    const audioPulse = Math.abs(audioState.breath || audioState.drift) * 0.01;
    const freqPulse = freqNorm * 0.9;
    const width = 2.0 + slowPulse + audioPulse + inhale * 1.8 + freqPulse * 0.7;
    const height = 0.9 + slowPulse * 0.7 + inhale * 1.1 + freqPulse * 0.5;
    three.centralGlow.scale.set(width, height, 1);
    const breathTint = new THREE.Color("#8bc4e5");
    three.centralGlow.material.color = baseColor.clone().lerp(breathTint, inhale);
    three.centralGlow.material.opacity = 0.5 + inhale * 0.3;
  }

  const audioTime = audioContext ? audioContext.currentTime * 1000 : time;
  updateAudio(audioTime);

  if (three.renderer && three.scene && three.camera) {
    three.renderer.render(three.scene, three.camera);
  }

  requestAnimationFrame(animateThree);
}

window.addEventListener("resize", () => {
  resizeThree();
});

initThree();

setInterval(() => {
  const level = 30 + Math.random() * 60;
  signalFill.style.width = `${level}%`;
}, 1200);
