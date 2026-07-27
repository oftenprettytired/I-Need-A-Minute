const SESSION_KEY = "inam-session-v1";
const ARCHIVE_KEY = "inam-archive-v1";

const STAGES = [
  "feeling",
  "cause",
  "reaction",
  "timeframe",
  "plan",
  "timerSetup",
  "timer",
  "revisitFeeling",
  "revisitResolution",
  "revisitNotes",
  "resolved",
];

const INTAKE_STAGES = ["feeling", "cause", "reaction", "timeframe", "plan"];
const REVISIT_STAGES = ["revisitFeeling", "revisitResolution", "revisitNotes"];

const TIMEFRAME_LABELS = {
  past: "the past",
  present: "right now",
  future: "the future",
  "doesnt-exist": "something that doesn't really exist",
};

const RESOLUTION_SENTENCES = {
  yes: "Yes, it was resolved.",
  no: "No, it wasn't resolved.",
  somewhat: "It was somewhat resolved.",
};

function createEmptySession() {
  return {
    stage: "feeling",
    feeling: "",
    cause: "",
    reaction: "",
    timeframe: "",
    plan: "",
    minutes: null,
    endTime: null,
    revisitFeeling: "",
    resolution: "",
    notes: "",
  };
}

function serializeSession(session) {
  return JSON.stringify(session);
}

function deserializeSession(json) {
  if (!json) return createEmptySession();
  try {
    const parsed = JSON.parse(json);
    return { ...createEmptySession(), ...parsed };
  } catch {
    return createEmptySession();
  }
}

function loadSession() {
  return deserializeSession(localStorage.getItem(SESSION_KEY));
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, serializeSession(session));
}

function hasSessionContent(session) {
  return Boolean(
    session.feeling ||
      session.cause ||
      session.reaction ||
      session.timeframe ||
      session.plan ||
      session.revisitFeeling ||
      session.resolution ||
      session.notes
  );
}

function createArchiveEntry(session) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
    // Deep-copy so later edits to the live session can't retroactively
    // change an already-saved archive entry.
    session: JSON.parse(JSON.stringify(session)),
  };
}

function deserializeArchive(json) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeArchive(archive) {
  return JSON.stringify(archive);
}

function loadArchive() {
  return deserializeArchive(localStorage.getItem(ARCHIVE_KEY));
}

function saveArchive(archive) {
  localStorage.setItem(ARCHIVE_KEY, serializeArchive(archive));
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function buildFirstPersonSummary(session) {
  const beforeParts = [];
  beforeParts.push(
    `I was feeling <strong>${escapeHtml(session.feeling) || "…"}</strong>${
      session.cause ? `, caused by <em>${escapeHtml(session.cause)}</em>` : ""
    }.`
  );
  if (session.reaction) beforeParts.push(`My first instinct was to <em>${escapeHtml(session.reaction)}</em>.`);
  if (session.timeframe) beforeParts.push(`This was happening in ${TIMEFRAME_LABELS[session.timeframe]}.`);
  if (session.plan) beforeParts.push(`My plan to calm down was to <em>${escapeHtml(session.plan)}</em>.`);

  const afterParts = [];
  afterParts.push(`After taking a minute, I felt <strong>${escapeHtml(session.revisitFeeling) || "…"}</strong>.`);
  if (session.resolution) afterParts.push(RESOLUTION_SENTENCES[session.resolution] || "");
  if (session.notes) afterParts.push(`Notes: <em>${escapeHtml(session.notes)}</em>.`);

  return `<p>${beforeParts.join(" ")}</p><p>${afterParts.join(" ")}</p>`;
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

let session = loadSession();

const DEFAULT_TITLE = document.title;

const stageEls = Object.fromEntries(STAGES.map((s) => [s, document.getElementById(s)]));
const stepIndicator = document.getElementById("stepIndicator");

const feelingForm = document.getElementById("feelingForm");
const feelingInput = document.getElementById("feelingInput");
const causeForm = document.getElementById("causeForm");
const causeInput = document.getElementById("causeInput");
const reactionForm = document.getElementById("reactionForm");
const reactionInput = document.getElementById("reactionInput");
const timeframeForm = document.getElementById("timeframeForm");
const planForm = document.getElementById("planForm");
const planInput = document.getElementById("planInput");

const minutesInput = document.getElementById("minutesInput");
const quickPicks = document.getElementById("quickPicks");
const goBtn = document.getElementById("goBtn");

const countdownDisplay = document.getElementById("countdownDisplay");
const skipTimerBtn = document.getElementById("skipTimerBtn");
const chime = document.getElementById("chime");

const revisitFeelingForm = document.getElementById("revisitFeelingForm");
const revisitFeelingInput = document.getElementById("revisitFeelingInput");
const resolutionChoices = document.getElementById("resolutionChoices");
const resolutionNextBtn = document.getElementById("resolutionNextBtn");
const revisitNotesForm = document.getElementById("revisitNotesForm");
const revisitNotesInput = document.getElementById("revisitNotesInput");

const resolvedSummary = document.getElementById("resolvedSummary");
const saveArchiveBtn = document.getElementById("saveArchiveBtn");
const resetBtn = document.getElementById("resetBtn");

let selectedResolution = "";
let timerIntervalId = null;

function goToStage(stage) {
  session.stage = stage;
  saveSession(session);
  renderStage();
}

function updateStepIndicator() {
  const intakeIdx = INTAKE_STAGES.indexOf(session.stage);
  const revisitIdx = REVISIT_STAGES.indexOf(session.stage);
  if (intakeIdx !== -1) {
    stepIndicator.textContent = `Step ${intakeIdx + 1} of ${INTAKE_STAGES.length}`;
    stepIndicator.hidden = false;
  } else if (revisitIdx !== -1) {
    stepIndicator.textContent = `Step ${revisitIdx + 1} of ${REVISIT_STAGES.length}`;
    stepIndicator.hidden = false;
  } else {
    stepIndicator.hidden = true;
  }
}

function renderStage() {
  for (const s of STAGES) stageEls[s].hidden = s !== session.stage;
  updateStepIndicator();

  if (session.stage === "feeling") feelingInput.value = session.feeling;
  if (session.stage === "cause") causeInput.value = session.cause;
  if (session.stage === "reaction") reactionInput.value = session.reaction;
  if (session.stage === "timeframe") fillTimeframe();
  if (session.stage === "plan") planInput.value = session.plan;
  if (session.stage === "timerSetup") minutesInput.value = session.minutes || 5;
  if (session.stage === "timer") startTimerLoop();
  if (session.stage === "revisitFeeling") revisitFeelingInput.value = session.revisitFeeling;
  if (session.stage === "revisitResolution") fillResolutionButtons();
  if (session.stage === "revisitNotes") revisitNotesInput.value = session.notes;
  if (session.stage === "resolved") resolvedSummary.innerHTML = buildFirstPersonSummary(session);
}

function fillTimeframe() {
  for (const radio of timeframeForm.querySelectorAll('input[name="timeframe"]')) {
    radio.checked = radio.value === session.timeframe;
  }
}

// Every "Back" link just steps to the previous entry in STAGES relative to
// whichever stage is currently showing.
document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const idx = STAGES.indexOf(session.stage);
    goToStage(STAGES[idx - 1]);
  });
});

feelingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  session.feeling = feelingInput.value.trim();
  goToStage("cause");
});

causeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  session.cause = causeInput.value.trim();
  goToStage("reaction");
});

reactionForm.addEventListener("submit", (e) => {
  e.preventDefault();
  session.reaction = reactionInput.value.trim();
  goToStage("timeframe");
});

timeframeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const checked = timeframeForm.querySelector('input[name="timeframe"]:checked');
  session.timeframe = checked ? checked.value : "";
  goToStage("plan");
});

planForm.addEventListener("submit", (e) => {
  e.preventDefault();
  session.plan = planInput.value.trim();
  goToStage("timerSetup");
});

quickPicks.querySelectorAll("button").forEach((btn) => {
  btn.addEventListener("click", () => {
    minutesInput.value = btn.dataset.minutes;
  });
});

goBtn.addEventListener("click", () => {
  const minutes = Math.min(180, Math.max(1, parseInt(minutesInput.value, 10) || 5));
  session.minutes = minutes;
  session.endTime = Date.now() + minutes * 60000;
  goToStage("timer");

  if (typeof Notification !== "undefined" && Notification.permission === "default") {
    Notification.requestPermission();
  }
});

function startTimerLoop() {
  clearInterval(timerIntervalId);
  updateCountdown();
  timerIntervalId = setInterval(updateCountdown, 250);
}

function updateCountdown() {
  const remainingMs = session.endTime - Date.now();
  if (remainingMs <= 0) {
    clearInterval(timerIntervalId);
    countdownDisplay.textContent = "0:00";
    onTimerComplete();
    return;
  }
  countdownDisplay.textContent = formatCountdown(remainingMs);
}

function onTimerComplete() {
  playChime();
  if (document.hidden) notifyTimeUp();
  document.title = "⏰ Time's up! — I Need A Minute";
  goToStage("revisitFeeling");
}

function playChime() {
  try {
    chime.currentTime = 0;
    chime.play().catch(() => {});
  } catch {
    // Autoplay can be blocked by the browser; the notification/title-flash
    // fallbacks still cover that case.
  }
}

function notifyTimeUp() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  new Notification("Time's up", {
    body: "Come back and check in with yourself.",
    icon: "icons/icon-192.png",
  });
}

window.addEventListener("focus", () => {
  document.title = DEFAULT_TITLE;
});

skipTimerBtn.addEventListener("click", () => {
  clearInterval(timerIntervalId);
  goToStage("revisitFeeling");
});

revisitFeelingForm.addEventListener("submit", (e) => {
  e.preventDefault();
  session.revisitFeeling = revisitFeelingInput.value.trim();
  goToStage("revisitResolution");
});

function fillResolutionButtons() {
  selectedResolution = session.resolution || "";
  updateResolutionButtons();
}

function updateResolutionButtons() {
  resolutionChoices.querySelectorAll(".choice-btn").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.value === selectedResolution);
  });
}

resolutionChoices.querySelectorAll(".choice-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    selectedResolution = btn.dataset.value;
    updateResolutionButtons();
  });
});

resolutionNextBtn.addEventListener("click", () => {
  session.resolution = selectedResolution;
  goToStage("revisitNotes");
});

revisitNotesForm.addEventListener("submit", (e) => {
  e.preventDefault();
  session.notes = revisitNotesInput.value.trim();
  goToStage("resolved");
});

saveArchiveBtn.addEventListener("click", () => {
  const archive = loadArchive();
  saveArchive([...archive, createArchiveEntry(session)]);
  const original = "Save to Archive";
  saveArchiveBtn.textContent = "Saved!";
  setTimeout(() => {
    saveArchiveBtn.textContent = original;
  }, 1500);
});

function doReset() {
  session = createEmptySession();
  saveSession(session);
  document.title = DEFAULT_TITLE;
  renderStage();
}

resetBtn.addEventListener("click", () => {
  if (!hasSessionContent(session)) {
    doReset();
    return;
  }
  const shouldSave = confirm(
    "This check-in has content. Save it to the archive first?\n\nClick OK to save it, or Cancel to continue without saving."
  );
  if (shouldSave) {
    saveArchive([...loadArchive(), createArchiveEntry(session)]);
    doReset();
    return;
  }
  if (!confirm("Continue without saving? This cannot be undone.")) return;
  doReset();
});

// If a timer was already running when the tab was closed and the end time
// has since passed, skip straight to the revisit stage on reload instead of
// showing a stale/expired countdown.
if (session.stage === "timer" && session.endTime && Date.now() >= session.endTime) {
  session.stage = "revisitFeeling";
  saveSession(session);
}

renderStage();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
