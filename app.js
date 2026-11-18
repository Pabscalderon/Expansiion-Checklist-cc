"use strict";

const gates = {
  gate1: {
    title: "Gate 1 · Pilot expansion",
    date: "April 15, 2027",
    coverage: "Aldine Community Table, Pasadena Hope Pantry, and warehouse sorting",
    approve: "Expand the pilot",
    approved: "Pilot expansion approved",
    fileName: "BCFN_Gate_1_Readiness.md"
  },
  gate2: {
    title: "Gate 2 · Launch readiness",
    date: "May 20, 2027",
    coverage: "All rollout sites and warehouse operations",
    approve: "Proceed to June 1 launch",
    approved: "June 1 launch approved",
    fileName: "BCFN_Gate_2_Readiness.md"
  }
};

const criteria = [
  {
    id: "training",
    title: "Site lead training",
    owner: "James Tran + site champions",
    gate1: "Each pilot site lead completes a one-hour session and demonstrates volunteer check-in and site ordering.",
    gate2: "Each rollout site lead completes a one-hour session and demonstrates volunteer check-in and site ordering.",
    detail: "Confirm Spanish and Vietnamese quick cards are available and leads can access buddy support.",
    prompt: "Record trained leads, dates, and demonstration results."
  },
  {
    id: "reporting",
    title: "Consistent reporting",
    owner: "Andre Williams",
    gate1: "The pilot has two consecutive weeks of complete reports on demand, shortages, leftovers, and waste.",
    gate2: "The rollout has two consecutive weeks of complete reports on demand, shortages, leftovers, and waste across all rollout sites.",
    prompt: "Record reporting periods, coverage, and corrected gaps."
  },
  {
    id: "weak-signal",
    title: "Weak-signal test",
    owner: "Ray Delgado",
    gate1: "Test volunteer check-in without a connection at a weak-signal pilot site. Reconnect and confirm the records sync correctly.",
    gate2: "Test volunteer check-in without a connection at weak-signal rollout sites. Reconnect and confirm the records sync correctly.",
    detail: "Test the actual volunteer check-in tool used at the sites.",
    prompt: "Record the site, device, date, and sync result."
  },
  {
    id: "fallback",
    title: "Fallback rehearsal",
    owner: "Site champions",
    gate1: "Pilot leads demonstrate paper check-in and phone-in ordering. Confirm backup materials and contact instructions are available.",
    gate2: "Rollout leads demonstrate paper check-in and phone-in ordering. Confirm backup materials and contact instructions are available at each site.",
    prompt: "Record the rehearsal dates, sites, and any follow-up."
  },
  {
    id: "performance",
    title: "Performance review",
    owner: "James Tran + Andre Williams",
    gate1: "Compare pilot attendance and waste with the pilot baseline. Document changes and resolve any issue that would block expansion.",
    gate2: "Review attendance and waste across rollout sites against their documented baselines. Resolve any issue that would block the June 1 launch.",
    prompt: "Record periods, evidence sources, results, and corrective work."
  },
  {
    id: "handoff",
    title: "Operations handoff",
    owner: "Monica Reyes",
    gate1: "Confirm who accepts volunteer scheduling, allocation, site support, and escalation for the expanded pilot. Name the owners for launch support and the August 1 handoff.",
    gate2: "Confirm owners accept volunteer scheduling, allocation, site support, and escalation across the rollout. Confirm June–July launch support and the August 1 handoff.",
    prompt: "Record accepted responsibilities, coverage dates, and escalation contacts."
  }
];

const storagePrefix = "bcfn-readiness-v1:";
const byId = (id) => document.getElementById(id);
const elements = {
  coverage: byId("coverage"),
  checks: byId("checks"),
  count: byId("progress-count"),
  progress: byId("progress-state"),
  form: byId("sponsor-form"),
  decision: byId("decision"),
  approve: byId("approve-option"),
  decisionHint: byId("decision-hint"),
  date: byId("review-date"),
  note: byId("review-note"),
  recorded: byId("recorded-review"),
  printGate: byId("print-gate"),
  printReview: byId("print-review"),
  saveStatus: byId("save-status"),
  reset: byId("reset"),
  resetConfirm: byId("reset-confirm"),
  resetDescription: byId("reset-description"),
  cancelReset: byId("cancel-reset")
};

const gateInputs = document.querySelectorAll('input[name="gate"]');
const checkRows = new Map();
const savedGates = new Set();
const unsavedGates = new Set();
let activeGate = "gate1";

function emptyGate() {
  return {
    checks: Object.fromEntries(criteria.map(({ id }) => [id, { evidence: "", verified: false }])),
    draft: { decision: "", date: "", note: "" },
    review: null,
    invalidated: false
  };
}

function verifiedCount(state) {
  return criteria.filter(({ id }) => {
    const check = state.checks[id];
    return check.verified && check.evidence.trim();
  }).length;
}

function validDecision(value) {
  return value === "approve" || value === "pause";
}

function normalizeDraft(value) {
  return {
    decision: validDecision(value?.decision) ? value.decision : "",
    date: typeof value?.date === "string" && /^\d{4,}-\d{2}-\d{2}$/.test(value.date) ? value.date : "",
    note: typeof value?.note === "string" ? value.note : ""
  };
}

function loadGate(gate) {
  const state = emptyGate();
  let raw;
  try {
    raw = localStorage.getItem(storagePrefix + gate);
  } catch {
    unsavedGates.add(gate);
    return state;
  }

  if (!raw) return state;
  let saved;
  try {
    saved = JSON.parse(raw);
  } catch {
    return state;
  }
  if (!saved || typeof saved !== "object") return state;

  for (const { id } of criteria) {
    const storedCheck = saved.checks?.[id];
    if (typeof storedCheck?.evidence === "string") {
      state.checks[id] = {
        evidence: storedCheck.evidence,
        verified: storedCheck.verified === true && Boolean(storedCheck.evidence.trim())
      };
    }
  }

  const ready = verifiedCount(state) === criteria.length;
  state.draft = normalizeDraft(saved.draft);
  if (!ready && state.draft.decision === "approve") state.draft.decision = "";

  const review = normalizeDraft(saved.review);
  if (review.decision && review.date && (review.decision === "pause" || ready)) {
    state.review = review;
  }
  state.invalidated = !state.review && (saved.invalidated === true || Boolean(saved.review));
  savedGates.add(gate);
  return state;
}

const records = { gate1: loadGate("gate1"), gate2: loadGate("gate2") };
const currentRecord = () => records[activeGate];

function renderSaveStatus() {
  if (unsavedGates.has(activeGate)) {
    elements.saveStatus.textContent = "This browser could not save your changes. Download the record to keep them.";
  } else {
    elements.saveStatus.textContent = savedGates.has(activeGate) ? "Saved on this device." : "Progress saves on this device.";
  }
}

function save() {
  try {
    localStorage.setItem(storagePrefix + activeGate, JSON.stringify(currentRecord()));
    savedGates.add(activeGate);
    unsavedGates.delete(activeGate);
  } catch {
    unsavedGates.add(activeGate);
  }
  renderSaveStatus();
}

function formatDate(date) {
  const parsed = new Date(date.length === 10 ? date + "T00:00:00Z" : date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(parsed);
}

function decisionLabel(gate, decision) {
  return decision === "approve" ? gate.approved : "Paused for corrections";
}

function gateStatus(state, gate) {
  if (state.review?.decision === "pause") return "Hold · sponsor paused";
  if (state.review?.decision === "approve") return gate.approved;
  if (verifiedCount(state) === criteria.length) return "Ready for sponsor review";
  return "Hold";
}

function renderSummary() {
  const state = currentRecord();
  const gate = gates[activeGate];
  const count = verifiedCount(state);
  const ready = count === criteria.length;
  const nextCount = count + " of " + criteria.length + " verified";
  const nextStatus = gateStatus(state, gate);

  if (elements.count.textContent !== nextCount) elements.count.textContent = nextCount;
  if (elements.progress.textContent !== nextStatus) elements.progress.textContent = nextStatus;
  elements.progress.toggleAttribute("data-ready", ready && state.review?.decision !== "pause");
  elements.approve.disabled = !ready;
  elements.decisionHint.textContent = ready ? "" : "Approval opens once all six checks are verified.";
  if (elements.decision.value !== state.draft.decision) elements.decision.value = state.draft.decision;

  const review = state.review;
  let message = "";
  if (review) {
    message = decisionLabel(gate, review.decision) + " · " + formatDate(review.date);
    if (review.note.trim()) message += "\n" + review.note.trim();
  } else if (state.invalidated) {
    message = "Readiness changed after the decision. Record a new sponsor decision.";
  }
  if (elements.recorded.textContent !== message) elements.recorded.textContent = message;
  elements.recorded.toggleAttribute("data-invalidated", state.invalidated);
  elements.printReview.textContent = message || "Sponsor decision pending";
}

function showCheckError(row, message) {
  row.error.textContent = message;
  if (message) {
    row.evidence.setAttribute("aria-invalid", "true");
    row.evidence.setAttribute("aria-describedby", row.error.id);
  } else {
    row.evidence.removeAttribute("aria-invalid");
    row.evidence.removeAttribute("aria-describedby");
  }
}

function renderCheck(id) {
  const check = currentRecord().checks[id];
  const row = checkRows.get(id);
  if (row.evidence.value !== check.evidence) row.evidence.value = check.evidence;
  row.checkbox.checked = check.verified;
  row.printStatus.textContent = check.verified ? "Verified" : "Not verified";
  row.printEvidence.textContent = check.evidence.trim() || "No evidence recorded.";
}

function readinessChanged() {
  const state = currentRecord();
  if (state.review) {
    state.invalidated = true;
    state.review = null;
    state.draft.decision = "";
  }
  if (verifiedCount(state) < criteria.length && state.draft.decision === "approve") state.draft.decision = "";
  renderSummary();
  save();
}

function createCheck(criterion) {
  const item = byId("check-template").content.firstElementChild.cloneNode(true);
  const id = criterion.id;
  const title = item.querySelector("h3");
  title.id = "check-" + id;
  title.textContent = criterion.title;
  item.querySelector(".owner-name").textContent = criterion.owner;
  if (criterion.detail) {
    const detail = item.querySelector(".check-detail");
    detail.textContent = criterion.detail;
    detail.hidden = false;
  }

  const evidence = item.querySelector("textarea");
  const checkbox = item.querySelector('input[type="checkbox"]');
  const error = item.querySelector(".field-error");
  const label = item.querySelector(".evidence-label");
  const verifyLabel = item.querySelector(".verify-label span");
  evidence.id = "evidence-" + id;
  evidence.placeholder = criterion.prompt;
  label.id = "label-" + id;
  label.htmlFor = evidence.id;
  verifyLabel.id = "verify-" + id;
  evidence.setAttribute("aria-labelledby", label.id + " " + title.id);
  checkbox.setAttribute("aria-labelledby", verifyLabel.id + " " + title.id);
  error.id = "error-" + id;

  const row = {
    evidence,
    checkbox,
    error,
    criterion: item.querySelector(".criterion"),
    printStatus: item.querySelector(".print-check-state"),
    printEvidence: item.querySelector(".print-evidence")
  };
  checkRows.set(id, row);

  evidence.addEventListener("input", () => {
    const check = currentRecord().checks[id];
    if (check.evidence === evidence.value) return;
    check.evidence = evidence.value;
    if (!check.evidence.trim()) check.verified = false;
    if (check.evidence.trim() && row.error.textContent) showCheckError(row, "");
    renderCheck(id);
    readinessChanged();
  });

  checkbox.addEventListener("change", () => {
    const check = currentRecord().checks[id];
    if (checkbox.checked && !check.evidence.trim()) {
      checkbox.checked = false;
      showCheckError(row, "Add evidence before verifying this check.");
      evidence.focus();
      return;
    }
    check.verified = checkbox.checked;
    showCheckError(row, "");
    renderCheck(id);
    readinessChanged();
  });

  return item;
}

function hideReset(restoreFocus = false) {
  elements.resetConfirm.hidden = true;
  elements.reset.setAttribute("aria-expanded", "false");
  if (restoreFocus) elements.reset.focus();
}

function renderGate() {
  const gate = gates[activeGate];
  const state = currentRecord();
  for (const input of gateInputs) input.checked = input.value === activeGate;
  elements.coverage.textContent = gate.coverage;
  elements.printGate.textContent = gate.title + " · " + gate.date;

  for (const criterion of criteria) {
    const row = checkRows.get(criterion.id);
    row.criterion.textContent = criterion[activeGate];
    showCheckError(row, "");
    renderCheck(criterion.id);
  }

  elements.approve.textContent = gate.approve;
  elements.date.value = state.draft.date;
  elements.note.value = state.draft.note;
  hideReset();
  renderSummary();
  renderSaveStatus();
}

function plainTextQuote(value) {
  const normalized = value.trim().replace(/[&<>]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;"
  })[character]);
  return normalized.split(/\r?\n/).map((line) => "> " + line.replace(/[\\`*_{}\[\]#|~!]/g, "\\$&")).join("\n");
}

function downloadRecord() {
  const gate = gates[activeGate];
  const state = currentRecord();
  const lines = [
    "# BCFN Pilot Readiness Checklist", "",
    "Fictional student case · Proposed criteria", "",
    "## " + gate.title, "",
    "- Review scheduled for " + gate.date,
    "- Coverage · " + gate.coverage,
    "- " + verifiedCount(state) + " of " + criteria.length + " verified · " + gateStatus(state, gate),
    ""
  ];

  for (const criterion of criteria) {
    const check = state.checks[criterion.id];
    lines.push(
      "### " + criterion.title, "",
      "- Owner · " + criterion.owner,
      "- Status · " + (check.verified ? "Verified" : "Not verified"), "",
      criterion[activeGate]
    );
    if (criterion.detail) lines.push("", criterion.detail);
    lines.push("", "**Evidence and notes**", "", check.evidence.trim() ? plainTextQuote(check.evidence) : "No evidence recorded.", "");
  }

  lines.push("## Sponsor decision", "", "Monica Reyes · Executive Director", "");
  if (state.review) {
    lines.push("- " + decisionLabel(gate, state.review.decision), "- Decision date · " + formatDate(state.review.date));
    if (state.review.note.trim()) lines.push("", "**Decision note**", "", plainTextQuote(state.review.note));
  } else {
    lines.push(state.invalidated ? "Previous decision invalidated by a change to readiness. New decision pending." : "Decision pending.");
  }

  const file = new Blob([lines.join("\n") + "\n"], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = gate.fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

elements.checks.append(...criteria.map(createCheck));
for (const input of gateInputs) {
  input.addEventListener("change", () => {
    if (!input.checked) return;
    activeGate = input.value;
    renderGate();
  });
}

elements.decision.addEventListener("change", () => {
  currentRecord().draft.decision = elements.decision.value;
  save();
});
elements.date.addEventListener("input", () => {
  currentRecord().draft.date = elements.date.value;
  save();
});
elements.note.addEventListener("input", () => {
  currentRecord().draft.note = elements.note.value;
  save();
});
elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  const state = currentRecord();
  const draft = normalizeDraft({ decision: elements.decision.value, date: elements.date.value, note: elements.note.value });
  if (!draft.decision || !draft.date) return;
  if (draft.decision === "approve" && verifiedCount(state) < criteria.length) return;
  state.draft = draft;
  state.review = { ...draft };
  state.invalidated = false;
  renderSummary();
  save();
});

elements.reset.addEventListener("click", () => {
  if (!elements.resetConfirm.hidden) {
    hideReset(true);
    return;
  }
  elements.resetDescription.textContent = "Clear the evidence, verification, and sponsor decision for " + gates[activeGate].title.split(" · ")[0] + "?";
  elements.resetConfirm.hidden = false;
  elements.reset.setAttribute("aria-expanded", "true");
  elements.cancelReset.focus();
});
elements.cancelReset.addEventListener("click", () => hideReset(true));
byId("confirm-reset").addEventListener("click", () => {
  records[activeGate] = emptyGate();
  save();
  renderGate();
  elements.reset.focus();
});
byId("download").addEventListener("click", downloadRecord);
byId("print").addEventListener("click", () => window.print());

renderGate();
