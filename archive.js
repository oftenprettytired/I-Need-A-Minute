const ARCHIVE_KEY = "inam-archive-v1";

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

function removeArchiveEntry(archive, id) {
  return archive.filter((entry) => entry.id !== id);
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

function formatSavedAt(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

function buildIntakeSummary(session) {
  const parts = [];
  parts.push(`You were feeling <strong>${escapeHtml(session.feeling) || "…"}</strong>.`);
  if (session.cause) parts.push(`Caused by: <em>${escapeHtml(session.cause)}</em>.`);
  if (session.reaction) parts.push(`Your first instinct: <em>${escapeHtml(session.reaction)}</em>.`);
  if (session.timeframe) parts.push(`This was happening in ${TIMEFRAME_LABELS[session.timeframe]}.`);
  if (session.plan) parts.push(`Your plan to calm down: <em>${escapeHtml(session.plan)}</em>.`);
  return `<p>${parts.join(" ")}</p>`;
}

function buildResolvedSummary(session) {
  const resParts = [];
  resParts.push(`Afterward you felt <strong>${escapeHtml(session.revisitFeeling) || "…"}</strong>.`);
  if (session.resolution) resParts.push(`Resolution: <strong>${RESOLUTION_LABELS[session.resolution] || session.resolution}</strong>.`);
  if (session.notes) resParts.push(`Notes: <em>${escapeHtml(session.notes)}</em>.`);
  return `${buildIntakeSummary(session)}<hr/><p>${resParts.join(" ")}</p>`;
}

const archiveListEl = document.getElementById("archiveList");
const emptyStateEl = document.getElementById("emptyState");

function buildCard(entry) {
  const { session } = entry;
  const card = document.createElement("article");
  card.className = "archive-card";
  card.dataset.id = entry.id;

  const summary = document.createElement("div");
  summary.className = "archive-card-summary";

  const info = document.createElement("div");
  const feelingDiv = document.createElement("div");
  feelingDiv.className = "archive-card-behavior";
  feelingDiv.textContent = session.feeling || "(no feeling named)";
  const metaDiv = document.createElement("div");
  metaDiv.className = "archive-card-meta";
  const resolutionLabel = session.resolution ? RESOLUTION_LABELS[session.resolution] || session.resolution : "unresolved";
  metaDiv.textContent = `Saved ${formatSavedAt(entry.savedAt)} · Resolution: ${resolutionLabel}`;
  info.append(feelingDiv, metaDiv);

  const actions = document.createElement("div");
  actions.className = "archive-card-actions";

  const detail = document.createElement("div");
  detail.className = "archive-card-detail";
  detail.hidden = true;
  detail.innerHTML = buildResolvedSummary(session);

  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.textContent = "View";
  viewBtn.addEventListener("click", () => {
    detail.hidden = !detail.hidden;
    viewBtn.textContent = detail.hidden ? "View" : "Hide";
  });

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.className = "danger";
  deleteBtn.textContent = "Delete";
  deleteBtn.addEventListener("click", () => {
    if (!confirm("Delete this saved check-in? This cannot be undone.")) return;
    saveArchive(removeArchiveEntry(loadArchive(), entry.id));
    render();
  });

  actions.append(viewBtn, deleteBtn);
  summary.append(info, actions);
  card.append(summary, detail);
  return card;
}

function render() {
  const archive = loadArchive()
    .slice()
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  archiveListEl.innerHTML = "";
  emptyStateEl.hidden = archive.length > 0;
  for (const entry of archive) {
    archiveListEl.appendChild(buildCard(entry));
  }
}

render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
