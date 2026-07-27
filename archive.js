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

const RESOLUTION_SENTENCES = {
  yes: "Yes, it was resolved.",
  no: "No, it wasn't resolved.",
  somewhat: "It was somewhat resolved.",
};

const CATEGORIES = [
  { key: "past", label: "Past" },
  { key: "present", label: "Right Now" },
  { key: "future", label: "Future" },
  { key: "doesnt-exist", label: "Doesn't Really Exist" },
  { key: "unspecified", label: "Not Specified" },
];

function categoryKey(session) {
  return session.timeframe && CATEGORIES.some((c) => c.key === session.timeframe) ? session.timeframe : "unspecified";
}

const RESOLUTION_CATEGORIES = [
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
  { key: "somewhat", label: "Somewhat" },
  { key: "unspecified", label: "Not Specified" },
];

function resolutionCategoryKey(session) {
  return session.resolution && RESOLUTION_CATEGORIES.some((c) => c.key === session.resolution)
    ? session.resolution
    : "unspecified";
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

function removeArchiveEntry(archive, id) {
  return archive.filter((entry) => entry.id !== id);
}

function loadArchive() {
  return deserializeArchive(localStorage.getItem(ARCHIVE_KEY));
}

function saveArchive(archive) {
  localStorage.setItem(ARCHIVE_KEY, serializeArchive(archive));
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

const archiveListEl = document.getElementById("archiveList");
const emptyStateEl = document.getElementById("emptyState");
const trackerSectionEl = document.getElementById("trackerSection");
const trackerBarEl = document.getElementById("trackerBar");
const trackerLegendEl = document.getElementById("trackerLegend");
const resolutionTrackerBarEl = document.getElementById("resolutionTrackerBar");
const resolutionTrackerLegendEl = document.getElementById("resolutionTrackerLegend");

function buildCategoryHeading(label, count) {
  const h = document.createElement("h2");
  h.className = "archive-category-heading";
  h.textContent = `${label} (${count})`;
  return h;
}

function renderTrackerBar(archive, categories, keyFn, barEl, legendEl) {
  const counts = Object.fromEntries(categories.map((c) => [c.key, 0]));
  for (const entry of archive) counts[keyFn(entry.session)] += 1;

  barEl.innerHTML = "";
  legendEl.innerHTML = "";

  for (const category of categories) {
    const count = counts[category.key];
    if (count === 0) continue;
    const pct = Math.round((count / archive.length) * 100);

    const segment = document.createElement("div");
    segment.className = `tracker-segment cat-${category.key}`;
    segment.style.width = `${(count / archive.length) * 100}%`;
    segment.title = `${category.label}: ${count} (${pct}%)`;
    barEl.appendChild(segment);

    const legendItem = document.createElement("div");
    legendItem.className = "tracker-legend-item";
    const dot = document.createElement("span");
    dot.className = `tracker-dot cat-${category.key}`;
    legendItem.appendChild(dot);
    legendItem.append(`${category.label} — ${count} (${pct}%)`);
    legendEl.appendChild(legendItem);
  }
}

function renderTracker(archive) {
  if (archive.length === 0) {
    trackerSectionEl.hidden = true;
    return;
  }
  trackerSectionEl.hidden = false;

  renderTrackerBar(archive, CATEGORIES, categoryKey, trackerBarEl, trackerLegendEl);
  renderTrackerBar(archive, RESOLUTION_CATEGORIES, resolutionCategoryKey, resolutionTrackerBarEl, resolutionTrackerLegendEl);
}

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
  detail.innerHTML = buildFirstPersonSummary(session);

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

  renderTracker(archive);

  archiveListEl.innerHTML = "";
  emptyStateEl.hidden = archive.length > 0;

  for (const category of CATEGORIES) {
    const entries = archive.filter((entry) => categoryKey(entry.session) === category.key);
    if (entries.length === 0) continue;
    archiveListEl.appendChild(buildCategoryHeading(category.label, entries.length));
    for (const entry of entries) archiveListEl.appendChild(buildCard(entry));
  }
}

const downloadAllBtn = document.getElementById("downloadAllBtn");
downloadAllBtn.addEventListener("click", () => {
  const archive = loadArchive();
  if (archive.length === 0) {
    alert("No saved check-ins to back up yet.");
    return;
  }
  const dateStamp = new Date().toISOString().slice(0, 10);
  downloadBlob(JSON.stringify(archive, null, 2), `i-need-a-minute-backup-${dateStamp}.json`, "application/json");
});

render();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js");
}
