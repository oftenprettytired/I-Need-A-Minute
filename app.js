const SESSION_KEY = "inam-session-v1";
const ARCHIVE_KEY = "inam-archive-v1";

const STAGES = ["intake", "summary", "timer", "revisit", "resolved"];

const TIMEFRAME_LABELS = {
  past: "the past",
  present: "right now",
  future: "the future",
  "doesnt-exist": "something that doesn't really exist",
};

const RESOLUTION_LABELS = {
  yes: "Yes",
  no: "No",
  somewhat: "Somewhat",
};

function createEmptySession() {
  return {
    stage: "intake",
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

function buildIntakeSummary(session) {
  const parts = [];
  parts.push(`You're feeling <strong>${escapeHtml(session.feeling) || "…"}</strong>.`);
  if (session.cause) parts.push(`Caused by: <em>${escapeHtml(session.cause)}</em>.`);
  if (session.reaction) parts.push(`Your first instinct: <em>${escapeHtml(session.reaction)}</em>.`);
  if (session.timeframe) parts.push(`This is happening in ${TIMEFRAME_LABELS[session.timeframe]}.`);
  if (session.plan) parts.push(`Your plan to calm down: <em>${escapeHtml(session.plan)}</em>.`);
  return `<p>${parts.join(" ")}</p>`;
}

function buildResolvedSummary(session) {
  const resParts = [];
  resParts.push(`Now you're feeling <strong>${escapeHtml(session.revisitFeeling) || "…"}</strong>.`);
  if (session.resolution) resParts.push(`Resolution: <strong>${RESOLUTION_LABELS[session.resolution]}</strong>.`);
  if (session.notes) resParts.push(`Notes: <em>${escapeHtml(session.notes)}</em>.`);
  return `${buildIntakeSummary(session)}<hr/><p>${resParts.join(" ")}</p>`;
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

const intakeForm = document.getElementById("intakeForm");
const feelingInput = document.getElementById("feeling");
const causeInput = document.getElementById("cause");
const reactionInput = document.getElementById("reaction");
const planInput = document.getElementById("plan");

const summaryText = document.getElementById("summaryText");
const editIntakeBtn = document.getElementById("editIntakeBtn");
const minutesInput = document.getElementById("minutesInput");
const quickPicks = document.getElementById("quickPicks");
const goBtn = document.getElementById("goBtn");

const countdownDisplay = document.getElementById("countdownDisplay");
const skipTimerBtn = document.getElementById("skipTimerBtn");
const chime = document.getElementById("chime");

const revisitForm = document.getElementById("revisitForm");
const revisitFeelingInput = document.getElementById("revisitFeeling");
const resolutionChoices = document.getElementById("resolutionChoices");
const revisitNotesInput = document.getElementById("revisitNotes");

const resolvedSummary = document.getElementById("resolvedSummary");
const saveArchiveBtn = document.getElementById("saveArchiveBtn");
const resetBtn = document.getElementById("resetBtn");

let selectedResolution = "";
let timerIntervalId = null;

function renderStage() {
  for (const s of STAGES) stageEls[s].hidden = s !== session.stage;

  if (session.stage === "intake") fillIntakeForm();
  if (session.stage === "summary") fillSummaryStage();
  if (session.stage === "timer") startTimerLoop();
  if (session.stage === "revisit") fillRevisitForm();
  if (session.stage === "resolved") resolvedSummary.innerHTML = buildResolvedSummary(session);
}

function fillIntakeForm() {
  feelingInput.value = session.feeling;
  causeInput.value = session.cause;
  reactionInput.value = session.reaction;
  planInput.value = session.plan;
  for (const radio of intakeForm.querySelectorAll('input[name="timeframe"]')) {
    radio.checked = radio.value === session.timeframe;
  }
}

function fillSummaryStage() {
  summaryText.innerHTML = buildIntakeSummary(session);
  minutesInput.value = session.minutes || 5;
}

intakeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  session.feeling = feelingInput.value.trim();
  session.cause = causeInput.value.trim();
  session.reaction = reactionInput.value.trim();
  session.plan = planInput.value.trim();
  const checked = intakeForm.querySelector('input[name="timeframe"]:checked');
  session.timeframe = checked ? checked.value : "";
  session.stage = "summary";
  saveSession(session);
  renderStage();
});

editIntakeBtn.addEventListener("click", () => {
  session.stage = "intake";
  saveSession(session);
  renderStage();
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
  session.stage = "timer";
  saveSession(session);
  renderStage();

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
  session.stage = "revisit";
  saveSession(session);
  renderStage();
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
  session.stage = "revisit";
  saveSession(session);
  renderStage();
});

function fillRevisitForm() {
  revisitFeelingInput.value = session.revisitFeeling;
  revisitNotesInput.value = session.notes;
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

revisitForm.addEventListener("submit", (e) => {
  e.preventDefault();
  session.revisitFeeling = revisitFeelingInput.value.trim();
  session.resolution = selectedResolution;
  session.notes = revisitNotesInput.value.trim();
  session.stage = "resolved";
  saveSession(session);
  renderStage();
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
  session.stage = "revisit";
  saveSession(session);
}

renderStage();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
