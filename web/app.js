import {
  createIcons,
  Sun,
  Users,
  Circle,
  Inbox,
  Plug,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  CheckCheck,
  Clock,
  Bell,
  CalendarDays,
  Sparkles,
  Copy,
  Download,
  Upload,
  FileArchive,
  Clipboard,
  ShieldCheck,
  RefreshCw,
  Star,
  MoreHorizontal,
  Menu,
  Pencil,
  HeartHandshake,
  MessageCircle,
  LogOut,
  Archive,
  RotateCcw,
  Target,
  LockKeyhole,
  CircleHelp,
  CheckCircle2,
  AlertCircle,
  Link,
} from "lucide";
import {
  normalizeContact,
  normalizeCircle,
  uid,
  nowISO,
  dateValue,
  recommendations,
  fallbackDraft,
  reminderCalendar,
  mergeContacts,
  DAY,
} from "../shared/domain.js";
import { importFile, parseContacts, parseBackup } from "../shared/import.js";
import { createReplyBuffer } from "./reply-buffer.js";
import { createMessageRecorder } from "./message-recorder.js";
import { demoState, mergeDemoImport } from "./demo.js";
import { createDraftSaver } from "./draft-saver.js";
import { createDraftJobs } from "./draft-jobs.js";
import { personFormValues, changedPersonFields } from "./person-form.js";
const iconSet = {
  Sun,
  Users,
  Circle,
  Inbox,
  Plug,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  CheckCheck,
  Clock,
  Bell,
  CalendarDays,
  Sparkles,
  Copy,
  Download,
  Upload,
  FileArchive,
  Clipboard,
  ShieldCheck,
  RefreshCw,
  Star,
  MoreHorizontal,
  Menu,
  Pencil,
  HeartHandshake,
  MessageCircle,
  LogOut,
  Archive,
  RotateCcw,
  Target,
  LockKeyhole,
  CircleHelp,
  CheckCircle2,
  AlertCircle,
  Link,
};
const $ = (s) => document.querySelector(s),
  app = $("#app"),
  overlay = $("#overlay");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const i = (name) => `<i data-lucide="${name}" aria-hidden="true"></i>`;
const btn = (label, action, icon = "", kind = "", extra = "") =>
  `<button class="button ${kind}" data-action="${action}" ${extra}>${icon ? i(icon) : ""}${esc(label)}</button>`;
const ib = (label, action, icon, extra = "") =>
  `<button class="icon-btn" title="${esc(label)}" aria-label="${esc(label)}" data-action="${action}" ${extra}>${i(icon)}</button>`;
const tones = ["green", "violet", "blue", "rose", "amber"];
let demo = new URLSearchParams(location.search).get("demo") === "1";
let data = {
  contacts: [],
  circles: [],
  messages: [],
  settings: { weeklyGoal: 3 },
  capabilities: {},
};
let route = "today",
  query = "",
  filter = "all",
  circleFilter = "all",
  page = 0,
  inboxFilter = "needs",
  selected = null,
  detailTab = "draft",
  modalName = "",
  stagedImport = null,
  activeColor = "green",
  lastFocus = null,
  loadError = "",
  toastTimer,
  undoAction,
  saveTimer;
let drafts = new Map(),
  variants = new Map(),
  intent = "catch-up",
  loginInfo = null;
const draftJobs = createDraftJobs();
const replyBuffer = createReplyBuffer();
const messageRecorder = createMessageRecorder();
const sentDrafts = new Map();
const draftAcknowledgements = new Map();
const personForms = new WeakMap();
const pendingPersonForms = new Set();
let draftWriteSerial = 0;
const workspace = () => (demo ? "demo" : "private");
const draftSaver = createDraftSaver(
  (id, value) => updateContact(id, { draft: value }, { paint: false }),
  () => paintDraftStatus(),
);
async function flushDraft() {
  clearTimeout(saveTimer);
  await draftSaver.flush();
}
function paintDraftStatus() {
  const label = $("#draft-saved"),
    retry = $("#retry-draft");
  if (!label || !selected) return;
  const status = draftSaver.status(selected);
  const message =
    status === "error"
      ? "Not saved. Keep this tab open."
      : status === "pending" || status === "saving"
        ? "Saving..."
        : (drafts.get(selected) ?? selectedContact()?.draft)
          ? "Draft saved"
          : "Only you can send this";
  if (label.textContent !== message) label.textContent = message;
  label.classList.toggle("save-error", status === "error");
  if (retry) {
    if (status === "error") retry.hidden = false;
    else if (status !== "saving") retry.hidden = true;
    retry.disabled = status === "saving";
  }
}
function paintDraftGeneration() {
  const button = overlay.querySelector('[data-action="draft"]');
  if (!button || !selected) return;
  const busy = draftJobs.isBusy(selected);
  const hasDraft = drafts.get(selected) ?? selectedContact()?.draft;
  const label = busy
    ? "Writing..."
    : hasDraft
      ? "Try another draft"
      : "Help me start";
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.innerHTML = `${i(busy ? "refresh-cw" : "sparkles")} ${label}`;
  icons();
}
function paintSentStatus() {
  const button = overlay.querySelector('[data-action="mark-sent"]');
  if (!button) return;
  const busy = sentDrafts.has(selected);
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  button.innerHTML = `${i(busy ? "refresh-cw" : "check-check")} ${busy ? "Recording..." : "I sent it"}`;
  icons();
}
window.addEventListener("beforeunload", (event) => {
  if (
    !draftSaver.hasUnsaved() &&
    !replyBuffer.hasUnsaved() &&
    !messageRecorder.hasPending() &&
    !sentDrafts.size &&
    !pendingPersonForms.size
  )
    return;
  event.preventDefault();
  event.returnValue = "";
});
function paintReplyStatus() {
  const form = $("#reply-form");
  if (!form) return;
  const status = replyBuffer.status(workspace(), form.dataset.contactId);
  const busy = status === "saving";
  const button = form.querySelector('[data-action="submit-reply"]');
  button.disabled = busy;
  button.setAttribute("aria-busy", String(busy));
  const label = form.querySelector('[role="status"]');
  label.textContent =
    status === "error"
      ? "Save not confirmed. Your text is still here."
      : busy
        ? "Saving message..."
        : status === "unsaved"
          ? "Not saved. Keep this tab open."
          : "";
  label.classList.toggle("save-error", status === "error");
}
const initials = (name) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
const colorOf = (c) =>
  data.circles.find((g) => c.circleIds.includes(g.id))?.color ||
  tones[c.name.length % tones.length];
const avatar = (c, size = "") =>
  `<span class="avatar ${colorOf(c)} ${size}" aria-hidden="true">${esc(initials(c.name))}</span>`;
const chip = (g) =>
  `<span class="chip ${g.color}"><span class="chip-dot"></span>${esc(g.name)}</span>`;
const circlesFor = (c) =>
  data.circles.filter((g) => c.circleIds.includes(g.id));
const active = () => data.contacts.filter((c) => !c.archived);
const replies = () =>
  active()
    .filter((c) => c.needsReply && dateValue(c.snoozedUntil) <= Date.now())
    .sort(
      (a, b) => dateValue(b.latestMessageAt) - dateValue(a.latestMessageAt),
    );
const latest = (c) => data.messages.filter((m) => m.contactId === c.id).at(-1);
const fmt = (d, options = { month: "short", day: "numeric" }) =>
  dateValue(d) ? new Date(d).toLocaleDateString(undefined, options) : "Not yet";
const relative = (d) => {
  const n = Math.max(0, Math.floor((Date.now() - dateValue(d)) / DAY));
  return !dateValue(d)
    ? "No check-in yet"
    : n === 0
      ? "Today"
      : n === 1
        ? "Yesterday"
        : `${n} days ago`;
};
const selectedContact = () => data.contacts.find((c) => c.id === selected);
function icons() {
  createIcons({ icons: iconSet, attrs: { "aria-hidden": "true" } });
}
function notify(message, error = false, undo = null) {
  clearTimeout(toastTimer);
  undoAction = undo;
  $("#toast").innerHTML =
    `<div class="toast ${error ? "error" : ""}">${esc(message)}${undo ? '<button data-action="undo">Undo</button>' : ""}</div>`;
  toastTimer = setTimeout(
    () => $("#toast").replaceChildren(),
    error ? 9000 : 5500,
  );
}
async function request(path, method = "GET", body) {
  const r = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(35000),
  });
  const result = await r.json();
  if (!r.ok) {
    if (r.status === 401) loginInfo = result;
    throw new Error(result.error || "Unable to complete that action.");
  }
  return result;
}
function persistDemo() {
  try {
    localStorage.setItem("rc-demo-v2", JSON.stringify(data));
  } catch {
    notify("This browser couldn't save demo changes.", true);
  }
}
async function refresh(renderPage = true) {
  if (demo) {
    if (renderPage) render();
    return;
  }
  const startedAtWrite = draftWriteSerial;
  const fresh = await request("/api/state");
  // A response may contain an older snapshot than an autosave acknowledged
  // while it was in flight. Keep that saved text and its token together.
  fresh.contacts = fresh.contacts.map((contact) => {
    const saved = draftAcknowledgements.get(contact.id);
    return saved?.serial > startedAtWrite
      ? { ...contact, draft: saved.draft, draftVersion: saved.draftVersion }
      : contact;
  });
  data = fresh;
  loadError = "";
  if (renderPage) render();
}
async function updateContact(id, patch, { paint = true } = {}) {
  const c = data.contacts.find((c) => c.id === id);
  if (!c) return;
  const next = demo
    ? { ...normalizeContact({ ...c, ...patch }), draftVersion: uid() }
    : await request(`/api/contacts/${encodeURIComponent(id)}`, "PATCH", patch);
  if (!demo) {
    draftAcknowledgements.set(id, {
      serial: ++draftWriteSerial,
      draft: next.draft,
      draftVersion: next.draftVersion,
    });
  }
  data.contacts = data.contacts.map((x) => (x.id === id ? next : x));
  if (demo) persistDemo();
  if (paint) render();
  return next;
}
async function addMessage(c, text, direction, expectedDraftVersion) {
  if (demo) {
    const at = nowISO();
    const current = data.contacts.find((person) => person.id === c.id);
    const clearDraft =
      direction === "out" &&
      expectedDraftVersion !== undefined &&
      (current.draftVersion ?? "") === expectedDraftVersion &&
      current.draft === text;
    data.messages.push({
      id: uid(),
      contactId: c.id,
      text,
      direction,
      at,
      source: "demo",
    });
    await updateContact(
      c.id,
      {
        needsReply: direction === "in",
        latestMessageAt: at,
        ...(direction === "out"
          ? {
              lastContactAt: at,
              reminderAt: "",
              ...(clearDraft ? { draft: "" } : {}),
            }
          : {}),
      },
      { paint: false },
    );
  } else {
    await messageRecorder.run(
      workspace(),
      c.id,
      { text, direction, expectedDraftVersion },
      async (body) => {
        await request(
          `/api/contacts/${encodeURIComponent(c.id)}/messages`,
          "POST",
          body,
        );
        await refresh(false);
      },
    );
  }
}
function getRoute() {
  const raw = location.hash.slice(1).split("?")[0];
  return [
    "today",
    "people",
    "circles",
    "inbox",
    "connections",
    "settings",
  ].includes(raw)
    ? raw
    : "today";
}
function go(next) {
  if (route === next) {
    render();
    return;
  }
  location.hash = next;
}
function week() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return {
    start,
    sent: data.messages.filter(
      (m) => m.direction === "out" && dateValue(m.at) >= start.getTime(),
    ),
  };
}
function pageHeading(title, description, action = "") {
  return `<header class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action}</header>`;
}
function empty(title, description, button = "", icon = "users") {
  return `<div class="empty">${i(icon)}<h2>${esc(title)}</h2><p>${esc(description)}</p>${button}</div>`;
}
function render() {
  route = getRoute();
  const names = {
    today: "Today",
    people: "People",
    circles: "Circles",
    inbox: "Inbox",
    connections: "Connections",
    settings: "Preferences",
  };
  const nav = (key, label, icon, badge = "") =>
    `<a href="#${key}" class="nav-item ${route === key ? "active" : ""}" ${route === key ? 'aria-current="page"' : ""}>${i(icon)}${label}${badge ? `<span class="badge">${badge}</span>` : ""}</a>`;
  app.innerHTML = `<div class="layout"><aside class="sidebar"><a class="brand" href="#today"><img src="/favicon.svg" alt=""><div><strong>Relationship<br>Copilot</strong><small>Make room for your people.</small></div></a><div class="workspace-label">${i("lock-keyhole")}Personal workspace${i("chevron-right")}</div><nav aria-label="Main navigation">${nav("today", "Today", "sun")}${nav("people", "People", "users")}${nav("circles", "Circles", "circle")}${nav("inbox", "Inbox", "inbox", replies().length || "")}<div class="nav-label">Workspace</div>${nav("connections", "Connections", "plug")}${nav("settings", "Preferences", "settings")}</nav><div class="sidebar-bottom">${btn(demo ? "Leave demo" : "Explore demo", demo ? "exit-demo" : "demo", demo ? "log-out" : "sparkles", "quiet")}<div class="user row"><span class="avatar small green">${esc(initials(data.settings.name || "You"))}</span><div><div class="user-name">${esc(data.settings.name || "Your workspace")}</div><div class="user-meta">${demo ? "Fictional demo data" : "A little more connected"}</div></div></div></div></aside><div class="main-shell"><div class="topbar"><div class="row">${ib("Open navigation", "menu", "menu", 'class="mobile-menu"').replace('class="icon-btn"', 'class="icon-btn mobile-menu"').replace(' class="mobile-menu"', "")}<div class="breadcrumb">Workspace <span>/ &nbsp; ${names[route]}</span></div></div><div class="top-actions"><button class="search-trigger" data-action="search">${i("search")}<span>Find someone</span></button><span class="quiet-status"><span class="status-dot"></span>${demo ? "Demo workspace" : "Private workspace"}</span>${ib("Add person", "add-person", "plus")}</div></div><main class="content" id="main">${demo ? '<div class="demo-strip"><span>Demo workspace · All people and conversations here are fictional.</span><button data-action="exit-demo">Your workspace ' + i("arrow-right") + "</button></div>" : ""}${loadError ? `<div class="error-banner">${esc(loadError)} ${btn("Retry", "reload", "refresh-cw")}</div>` : ""}${{ today: todayView, people: peopleView, circles: circlesView, inbox: inboxView, connections: connectionsView, settings: settingsView }[route]()}<footer class="page-footer"><span>Good relationships start with a small hello.</span><span>Relationship Copilot · v2.0</span></footer></main></div></div>`;
  icons();
  document.title = `${names[route]} · Relationship Copilot`;
}
function welcomeView() {
  return `<section class="welcome"><svg class="network" viewBox="0 0 230 122" role="img" aria-label="A personal network with four connected people"><line x1="108" y1="61" x2="34" y2="30"/><line x1="108" y1="61" x2="196" y2="23"/><line x1="108" y1="61" x2="192" y2="104"/><line x1="108" y1="61" x2="30" y2="103"/><circle cx="108" cy="61" r="25"/><circle cx="34" cy="30" r="15"/><circle cx="196" cy="23" r="17"/><circle cx="192" cy="104" r="14"/><circle cx="30" cy="103" r="13"/><text x="108" y="65" text-anchor="middle">YOU</text></svg><div class="eyebrow">Your people, a little closer</div><h1>Keep in touch.<br>Without overthinking it.</h1><p>Start with one person you've been meaning to message. You don't need your whole network to make a little progress.</p><div class="row wrap">${btn("Add your first person", "add-person", "plus", "primary")}${btn("Explore the demo", "demo", "arrow-right", "quiet")}</div><div class="onboarding-steps"><div class="onboarding-step"><span class="step-num">01</span><div><h3>Remember what connects you</h3><p>Old teams, shared projects, good advice. A little context makes the next hello easier.</p></div></div><div class="onboarding-step"><span class="step-num">02</span><div><h3>Make space for a small check-in</h3><p>Choose a comfortable rhythm. Three thoughtful messages a week is a good start.</p></div></div><div class="onboarding-step"><span class="step-num">03</span><div><h3>Keep the conversation going</h3><p>Save replies and put the next catch-up on your calendar.</p></div></div></div><div class="row wrap">${btn("Get LinkedIn contacts", "connections", "plug", "quiet")}${btn("Import your contacts", "import", "upload", "quiet")}</div></section>`;
}
function todayView() {
  if (!active().length) return welcomeView();
  const picks = recommendations(data.contacts, data.circles).slice(0, 3),
    w = week(),
    sent = new Set(w.sent.map((m) => m.contactId)).size,
    goal = data.settings.weeklyGoal || 3;
  const due = active().filter(
    (c) =>
      dateValue(c.reminderAt) &&
      dateValue(c.reminderAt) <= Date.now() &&
      dateValue(c.snoozedUntil) <= Date.now(),
  );
  return `<header class="page-heading"><div><div class="eyebrow">${esc(new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))}</div><h1>A little closer, one hello at a time.</h1><p>${esc(data.settings.name ? `${data.settings.name}, ` : "")}there's no perfect message. A thoughtful one is enough.</p></div>${btn("Add person", "add-person", "plus")}</header><div class="overview"><div class="overview-item">${i("users")}<div><strong>${active().length}</strong><p>People in your corner</p></div><small>${data.circles.length} circles</small></div><div class="overview-item">${i("message-circle")}<div><strong>${replies().length}</strong><p>Conversations to pick up</p></div>${replies().length ? "<small>Your turn</small>" : ""}</div><div class="overview-item">${i("heart-handshake")}<div><strong>${sent}<span class="muted"> / ${goal}</span></strong><p>People contacted this week</p></div></div></div><div class="today-grid"><section><div class="section-heading"><div><h2>This week's small hellos</h2><p>A few people worth making time for.</p></div>${ib("How suggestions work", "ranking-info", "circle-help")}</div>${picks.length ? picks.map((r, n) => `<article class="contact-pick"><span class="rank">0${n + 1}</span>${avatar(r.contact)}<div><button class="person-button" data-action="person" data-id="${r.contact.id}"><div><div class="person-title">${esc(r.contact.name)}${r.contact.favorite ? i("star") : ""}</div><div class="person-role">${esc(r.contact.role)}${r.contact.company ? ` · ${esc(r.contact.company)}` : ""}</div></div></button><p class="pick-reason">${esc(r.reason)}</p><div class="pick-footer">${r.shared.slice(0, 1).map(chip).join("")}<span class="small-caption">${r.days === null ? "First check-in" : `${r.days} days since your last hello`}</span></div></div><div class="pick-action">${btn("Say hello", "person", "arrow-up-right", n === 0 ? "primary" : "", `data-id="${r.contact.id}"`)}${ib("Remind me next week", "snooze", "clock", `data-id="${r.contact.id}"`)}</div></article>`).join("") : empty("You're all caught up", "A little breathing room is good. Browse your people whenever you're ready.", btn("See your people", "people", "users"), "check-circle-2")}<div class="bottom-note">${i("sparkles")}A shared memory is a better opener than a perfect introduction.</div>${due.length ? `<section style="margin-top:30px"><div class="section-heading"><h2>On your list today</h2></div>${due.map((c) => `<button class="reply-mini" data-action="person" data-id="${c.id}">${avatar(c, "small")}<div class="grow"><strong>${esc(c.name)}</strong><p>Follow-up due ${fmt(c.reminderAt)}</p></div>${i("arrow-up-right")}</button>`).join("")}</section>` : ""}</section><aside class="rail"><section class="rail-section"><div class="between"><h3>Your weekly rhythm</h3>${i("target")}</div><div class="goal-number"><strong>${sent}</strong><span>/ ${goal}</span><small>${sent >= goal ? "Nicely done" : "Small steps count"}</small></div><div class="progress" role="progressbar" aria-label="Weekly goal" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(sent, goal)}"><span style="width:${Math.min(100, (sent / goal) * 100)}%"></span></div><p class="rail-note">${sent >= goal ? "You've made time for your people this week." : `${Math.max(0, goal - sent)} more ${goal - sent === 1 ? "person" : "people"} to reach your weekly intention.`}</p><div class="week-days">${[
    "M",
    "T",
    "W",
    "T",
    "F",
    "S",
    "S",
  ]
    .map((d, n) => {
      const day = new Date(w.start);
      day.setDate(day.getDate() + n);
      const done = w.sent.some(
        (m) => new Date(m.at).toDateString() === day.toDateString(),
      );
      return `<span class="day ${done ? "done" : ""} ${day.toDateString() === new Date().toDateString() ? "today" : ""}"><span class="day-circle">${done ? i("check") : day.getDate()}</span>${d}</span>`;
    })
    .join(
      "",
    )}</div></section><section class="rail-section"><div class="between"><h3>Waiting on your hello</h3><a class="text-link" href="#inbox">${i("arrow-up-right")}</a></div>${
    replies()
      .slice(0, 3)
      .map(
        (c) =>
          `<button class="reply-mini" data-action="conversation" data-id="${c.id}">${avatar(c, "small")}<div class="grow"><strong>${esc(c.name)}</strong><p>${esc(latest(c)?.text || "A conversation to pick up.")}</p></div><span class="unread-dot"></span></button>`,
      )
      .join("") ||
    '<p class="rail-note" style="margin-top:15px">No replies waiting. A good moment for a fresh hello.</p>'
  }</section><section class="rail-section"><div class="between"><h3>Your circles</h3><a class="text-link" href="#circles">${i("arrow-up-right")}</a></div>${data.circles
    .slice(0, 4)
    .map(
      (g) =>
        `<button class="circle-mini" data-action="circle-people" data-id="${g.id}"><span class="circle-symbol ${g.color}">${i("users")}</span>${esc(g.name)}<span>${active().filter((c) => c.circleIds.includes(g.id)).length}</span></button>`,
    )
    .join("")}</section></aside></div>`;
}
function visiblePeople() {
  return data.contacts
    .filter(
      (c) =>
        (filter === "archived" ? c.archived : !c.archived) &&
        (filter !== "favorites" || c.favorite) &&
        (filter !== "drafts" || c.draft) &&
        (filter !== "snoozed" || dateValue(c.snoozedUntil) > Date.now()) &&
        (circleFilter === "all" || c.circleIds.includes(circleFilter)) &&
        [
          c.name,
          c.company,
          c.role,
          c.memory,
          ...circlesFor(c).map((g) => g.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
function peopleTable() {
  const all = visiblePeople(),
    visible = all.slice(page * 30, page * 30 + 30);
  return all.length
    ? `<div class="table-wrap"><table><thead><tr><th>Person</th><th>Circle</th><th>Last hello</th><th>Next step</th><th><span class="hide">Actions</span></th></tr></thead><tbody>${visible.map((c) => `<tr><td><button class="person-button" data-action="person" data-id="${c.id}">${avatar(c)}<div><div class="person-title">${esc(c.name)}${c.favorite ? i("star") : ""}</div><div class="person-role">${esc(c.role)}${c.company ? ` · ${esc(c.company)}` : ""}</div></div></button></td><td>${circlesFor(c).slice(0, 1).map(chip).join("") || '<span class="muted">Unsorted</span>'}${c.circleIds.length > 1 ? ` <small class="muted">+${c.circleIds.length - 1}</small>` : ""}</td><td>${relative(c.lastContactAt)}</td><td><span class="pill-status ${c.needsReply ? "reply" : ""}">${c.needsReply ? "Your turn" : dateValue(c.snoozedUntil) > Date.now() ? `Snoozed to ${fmt(c.snoozedUntil)}` : c.draft ? "Draft saved" : c.archived ? "Archived" : "Keep in touch"}</span></td><td>${ib("Edit " + c.name, "edit-person", "pencil", `data-id="${c.id}"`)}</td></tr>`).join("")}</tbody></table></div><div class="table-foot"><span>${all.length} ${all.length === 1 ? "person" : "people"}</span>${all.length > 30 ? `<div class="row">${ib("Previous page", "prev", "chevron-left", page === 0 ? "disabled" : "")}<span>${page + 1} / ${Math.ceil(all.length / 30)}</span>${ib("Next page", "next", "chevron-right", (page + 1) * 30 >= all.length ? "disabled" : "")}</div>` : ""}</div>`
    : empty(
        "No people here yet",
        query
          ? "Try a different name, company, or shared memory."
          : "Add someone you've been meaning to catch up with.",
        btn("Add person", "add-person", "plus"),
      );
}
function peopleView() {
  const g = data.circles.find((g) => g.id === circleFilter);
  return `${pageHeading(g ? g.name : "Your people", g ? "A shared chapter, even when careers take different directions." : "The people you want to stay close to.", btn("Add person", "add-person", "plus", "primary"))}${g ? `<div class="circle-memory"><div class="between"><h3>What connects you</h3>${btn("Edit circle", "edit-circle", "pencil", "quiet", `data-id="${g.id}"`)}</div><p>${esc(g.memory || "Add a memory that connects this group.")}</p></div>` : ""}<div class="toolbar"><label class="search-field">${i("search")}<input id="people-search" aria-label="Search people" placeholder="Search people, companies, or memories" value="${esc(query)}"></label><select id="people-filter" aria-label="Filter people">${[
    ["all", "All people"],
    ["favorites", "Close connections"],
    ["drafts", "Drafts"],
    ["snoozed", "Snoozed"],
    ["archived", "Archived"],
  ]
    .map(
      ([v, l]) =>
        `<option value="${v}" ${filter === v ? "selected" : ""}>${l}</option>`,
    )
    .join(
      "",
    )}</select><select id="circle-filter" aria-label="Filter by circle"><option value="all">All circles</option>${data.circles.map((g) => `<option value="${g.id}" ${circleFilter === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select>${btn("Import", "import", "upload", "quiet")}</div><div id="people-results">${peopleTable()}</div>`;
}
function circlesView() {
  return `${pageHeading("Shared chapters", "Remember where you met, not just where they work now.", btn("New circle", "new-circle", "plus", "primary"))}${
    data.circles.length
      ? `<div class="circle-grid">${data.circles
          .map((g) => {
            const people = active().filter((c) => c.circleIds.includes(g.id));
            return `<article class="circle-card"><span class="circle-symbol ${g.color}">${i("users")}</span>${ib("Edit " + g.name, "edit-circle", "pencil", `data-id="${g.id}"`)}<h2>${esc(g.name)}</h2><p>${esc(g.memory || "Every circle starts with a shared story. Add yours.")}</p><div class="avatar-stack">${people
              .slice(0, 6)
              .map((c) => avatar(c, "small"))
              .join(
                "",
              )}</div><div class="card-footer"><span>${people.length} ${people.length === 1 ? "person" : "people"} · ${people.filter((c) => c.needsReply).length} to reply to</span><button class="text-link" data-action="circle-people" data-id="${g.id}">View circle ${i("arrow-right")}</button></div></article>`;
          })
          .join("")}</div>`
      : empty(
          "Your next hello has a backstory",
          "Create a circle for an old team, your school friends, or people you learn from.",
          btn("Create a circle", "new-circle", "plus"),
        )
  }`;
}
function inboxView() {
  const people = active()
    .filter((c) =>
      inboxFilter === "needs"
        ? c.needsReply && dateValue(c.snoozedUntil) <= Date.now()
        : inboxFilter === "reminders"
          ? Boolean(c.reminderAt)
          : Boolean(latest(c)),
    )
    .sort(
      (a, b) => dateValue(b.latestMessageAt) - dateValue(a.latestMessageAt),
    );
  return `${pageHeading("Pick up the conversation", "A reply is the start of something, not another thing to keep in your head.")}${!demo && !data.connection?.portability ? '<div class="notice" style="margin-bottom:24px">Replies you save appear here. Standard LinkedIn sign-in does not sync your inbox.</div>' : ""}<div class="toolbar"><div class="segmented" role="group" aria-label="Inbox view">${[
    ["needs", "Your turn"],
    ["all", "All conversations"],
    ["reminders", "Reminders"],
  ]
    .map(
      ([v, l]) =>
        `<button class="${inboxFilter === v ? "active" : ""}" data-action="inbox-filter" data-id="${v}" aria-pressed="${inboxFilter === v}">${l}${v === "needs" ? ` · ${replies().length}` : ""}</button>`,
    )
    .join(
      "",
    )}</div></div>${people.length ? people.map((c) => `<button class="inbox-row" data-action="conversation" data-id="${c.id}">${avatar(c)}<div class="grow"><div class="person-title">${esc(c.name)}${c.needsReply ? '<span class="unread-dot"></span>' : ""}</div><div class="person-role">${esc(c.company || c.relationship)}</div><p>${esc(latest(c)?.text || "A reminder to reconnect.")}</p></div><div class="inbox-meta"><span>${relative(c.latestMessageAt || c.lastContactAt)}</span>${c.reminderAt ? `<span class="chip amber">${i("clock")}${fmt(c.reminderAt)}</span>` : ""}</div></button>`).join("") : empty("A little breathing room", inboxFilter === "needs" ? "No conversations waiting on you. You're free to start a new one." : "Open a person to save a reply or set a reminder.", btn("Browse people", "people", "users"), "inbox")}`;
}
function connectionsView() {
  const s = data.settings;
  return `${pageHeading("Bring your network with you", "LinkedIn data, on your terms.", btn("Import archive", "import", "upload", "primary"))}<section class="integration"><div class="provider-logo" aria-label="LinkedIn">in</div><div><div class="row wrap"><h2>Your LinkedIn network</h2><span class="chip blue">Official export</span></div><p>Import your connections once, then refresh whenever you need. Your notes, circles, and conversations stay with each person.</p><div class="status"><span class="row">${i("shield-check")}No password sharing</span><span class="row">${i("check")}No scraping or auto-sending</span></div>${s.lastImportedAt ? `<p>Last imported ${fmt(s.lastImportedAt, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${s.lastImportCount} records</p>` : ""}</div><a class="button" href="https://www.linkedin.com/mypreferences/d/download-my-data" target="_blank" rel="noopener noreferrer">Open LinkedIn ${i("arrow-up-right")}</a></section><div class="export-steps"><section><span class="step-number">01</span><h3>Request your connections</h3><p>In LinkedIn's data settings, choose Connections and request the archive. Complete sign-in or verification directly on LinkedIn.</p></section><section><span class="step-number">02</span><h3>Bring the ZIP here</h3><p>When LinkedIn emails you, download the archive. No unzipping or spreadsheet cleanup needed.</p></section><section><span class="step-number">03</span><h3>Review, then import</h3><p>See new people and matches before saving. Only connection records leave your browser; other archive files are ignored.</p></section></div><div class="integration-help"><h3>For US LinkedIn accounts</h3><p>LinkedIn does not offer general official access to your personal network or inbox here. Its standard sign-in only shares your own profile. This is a snapshot, not a live connection.</p><div class="row wrap" style="margin-top:16px">${btn("Could an agent help?", "linkedin-help", "circle-help", "quiet")}<a class="text-link" href="https://www.linkedin.com/help/linkedin/answer/a1339364/downloading-your-account-data" target="_blank" rel="noopener noreferrer">LinkedIn's export guide ${i("arrow-up-right")}</a></div></div><section><div class="section-heading"><div><h2>Or start small</h2><p>One real relationship is enough to begin.</p></div></div><div class="import-options"><button class="import-option" data-action="add-person">${i("plus")}<h3>Add a person</h3><p>A name and a shared memory.</p></button><button class="import-option" data-action="import">${i("file-archive")}<h3>Import CSV or ZIP</h3><p>Connections.csv, a LinkedIn ZIP, or a Copilot backup.</p></button><button class="import-option" data-action="paste">${i("clipboard")}<h3>Paste contact rows</h3><p>A table from a spreadsheet works too.</p></button></div></section>`;
}
function settingsView() {
  const s = data.settings;
  return `${pageHeading("Make it yours", "A rhythm that feels comfortable. A message that sounds like you.")}<div class="settings-layout"><form id="settings-form"><section class="settings-section"><h2>Your rhythm</h2><label>Your first name<input name="name" value="${esc(s.name)}" maxlength="80" placeholder="What should we call you?"></label><label class="field-row"><span>People to contact each week<small style="display:block;margin-top:5px">An intention, not a quota.</small></span><input name="weeklyGoal" type="number" min="1" max="20" value="${s.weeklyGoal || 3}" required></label></section><section class="settings-section"><h2>Your voice</h2><label>A few notes on how you write<textarea name="voice" maxlength="4000" placeholder="Short and direct. I usually start with Hey. No exclamation marks unless I really mean them.">${esc(s.voice)}</textarea><small>Used only when you ask AI for a draft. Don't include confidential information.</small></label><span class="chip ${data.capabilities.ai ? "green" : "amber"}">${data.capabilities.ai ? "AI drafting available" : "AI key not configured · Starter drafts available"}</span></section><section class="settings-section"><h2>Reminders</h2><label class="checkbox-row"><input type="checkbox" name="notifications" ${s.notifications ? "checked" : ""}>Show a browser notification when a reminder is due</label><p>Browser reminders work while this app is open. Add a reminder to your calendar for alerts when it's closed.</p></section>${btn("Save preferences", "submit-settings", "check", "primary")}</form><section class="settings-section"><h2>Your data</h2><p>${demo ? "Demo changes stay in a separate browser workspace." : "Contacts, notes, and conversations are saved in your private workspace. AI receives selected context only when you request a draft."}</p><div class="row wrap">${btn("Export backup", "export", "download")}${btn("Restore backup", "import", "upload")}${localStorage.getItem("relationship-copilot-contacts") ? btn("Bring in old workspace", "migrate", "rotate-ccw") : ""}</div></section></div>`;
}
function openOverlay(html) {
  lastFocus = document.activeElement;
  overlay.innerHTML = html;
  app.inert = true;
  document.body.style.overflow = "hidden";
  icons();
  overlay
    .querySelector("input:not([type=checkbox]),textarea,button,a")
    ?.focus();
}
function closeOverlay() {
  overlay.replaceChildren();
  app.inert = false;
  document.body.style.overflow = "";
  modalName = "";
  selected = null;
  lastFocus?.isConnected && lastFocus.focus();
}
function modal(title, content) {
  openOverlay(
    `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="modal-head"><h2>${esc(title)}</h2>${ib("Close", "close", "x")}</header>${content}</section></div>`,
  );
}
function openPerson(id, tab = "draft") {
  selected = id;
  detailTab = tab;
  intent = selectedContact()?.needsReply ? "reply" : "catch-up";
  drawDetail(true);
}
function drawDetail(first = false) {
  const c = selectedContact();
  if (!c) return;
  const previousForm = $("#reply-form");
  const activeField =
    previousForm?.dataset.contactId === c.id &&
    previousForm.contains(document.activeElement)
      ? document.activeElement
      : null;
  const focus = activeField?.name
    ? {
        name: activeField.name,
        start: activeField.selectionStart,
        end: activeField.selectionEnd,
        scroll: activeField.scrollTop,
      }
    : null;
  const groups = circlesFor(c),
    messages = data.messages.filter((m) => m.contactId === c.id),
    savedDraft = drafts.get(c.id) ?? c.draft ?? "",
    v = variants.get(c.id);
  const header = `<div class="detail-top"><div class="between" style="margin-bottom:20px"><span class="eyebrow" style="margin:0">${detailTab === "conversation" ? "Conversation" : "Your people"}</span><div class="row">${ib(c.favorite ? "Remove from close connections" : "Mark as close connection", "favorite", "star", `data-id="${c.id}" aria-pressed="${c.favorite}"`)}${ib("Edit person", "edit-person", "pencil", `data-id="${c.id}"`)}${ib("Close detail", "close", "x")}</div></div><div class="detail-header">${avatar(c, "large")}<div class="grow"><h2>${esc(c.name)}</h2><p class="person-role">${esc(c.role)}${c.company ? ` · ${esc(c.company)}` : ""}</p><div class="row wrap" style="margin-top:12px">${groups.map(chip).join("")}</div></div></div><div class="tabs" role="tablist" aria-label="Contact details">${[
    ["draft", "Write a hello"],
    [
      "conversation",
      `Conversation${messages.length ? ` · ${messages.length}` : ""}`,
    ],
    ["about", "Relationship"],
  ]
    .map(
      ([v, l]) =>
        `<button role="tab" aria-selected="${detailTab === v}" class="${detailTab === v ? "active" : ""}" data-action="detail-tab" data-id="${v}">${l}</button>`,
    )
    .join("")}</div></div>`;
  let body = "";
  if (detailTab === "draft")
    body = `${c.memory ? `<section><div class="detail-label">A little context</div><p class="detail-memory">${esc(c.memory)}</p></section>` : ""}${c.needsReply && latest(c)?.direction === "in" ? `<section><div class="detail-label">Their last message</div><div class="bubble">${esc(latest(c).text)}</div></section>` : ""}<section class="composer"><div class="between"><h3>Your next hello</h3><span class="chip ${data.capabilities.ai ? "green" : "amber"}">${data.capabilities.ai ? "AI available" : "Starter draft"}</span></div><div class="composer-options"><select id="draft-intent" aria-label="Message intent">${[
      ["catch-up", "Catch up"],
      ["perspective", "Ask for perspective"],
      ["thank-you", "Say thanks"],
      ["reply", "Reply"],
    ]
      .map(
        ([value, l]) =>
          `<option value="${value}" ${intent === value ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select>${btn(savedDraft ? "Try another draft" : "Help me start", "draft", "sparkles")}</div>${v ? `<div class="row">${btn("Direct", "variant", "", "quiet", 'data-id="0"')}${btn("Warmer", "variant", "", "quiet", 'data-id="1"')}</div>` : ""}<label><span class="hide">Message draft</span><textarea id="draft-text" aria-label="Message draft" placeholder="Start with a simple hello..." maxlength="8000">${esc(savedDraft)}</textarea></label><div class="composer-meta"><span class="draft-save-state"><span id="draft-saved" role="status" aria-live="polite"></span>${ib("Retry saving draft", "retry-draft", "refresh-cw", 'id="retry-draft" hidden')}</span><span id="word-count">${savedDraft.trim() ? savedDraft.trim().split(/\s+/).length : 0} words</span></div>${v ? `<div class="notice">${esc(v.grounding)}${v.needsReview ? " Review before sending." : ""}</div>` : !data.capabilities.ai ? '<p class="small-caption">Starter drafts are simple suggestions, not AI. Add one real detail to make yours personal.</p>' : ""}<div class="detail-actions">${btn("Copy message", "copy", "copy", "primary")}${c.url ? `<a class="button" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">Open LinkedIn ${i("arrow-up-right")}</a>` : btn("Add LinkedIn link", "edit-person", "link", "", `data-id="${c.id}"`)}</div><div class="between" style="margin-top:8px">${btn("I sent it", "mark-sent", "check-check", "quiet")}${btn("Next week", "snooze", "clock", "quiet", `data-id="${c.id}"`)}</div></section>`;
  if (detailTab === "conversation")
    body = `<section>${messages.length ? messages.map((m) => `<div class="bubble ${m.direction}">${esc(m.text)}</div><div class="message-meta ${m.direction}">${m.direction === "out" ? "You" : esc(c.name.split(" ")[0])} · ${fmt(m.at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${m.source === "linkedin" ? "LinkedIn" : "Saved manually"}</div>`).join("") : '<p class="muted">No conversation saved yet.</p>'}</section><form class="reply-form" id="reply-form"><label>Save a message<textarea name="text" placeholder="Paste their reply here..." required maxlength="12000"></textarea></label><div class="between"><select name="direction" aria-label="Message direction"><option value="in">Their reply</option><option value="out">My message</option></select>${btn("Save message", "submit-reply", "plus", "primary")}</div></form>${c.needsReply ? `<div class="detail-actions">${btn("Draft a reply", "reply-draft", "sparkles")}${btn("No reply needed", "resolve", "check")}</div>` : ""}<form id="reminder-form" class="reply-form"><label>When should we remind you?<input type="datetime-local" name="reminderAt" value="${localDate(c.reminderAt)}" required></label><div class="detail-actions">${btn("Set reminder", "submit-reminder", "bell")}${btn("Add to calendar", "calendar", "calendar-days")}${c.reminderAt ? btn("Clear", "clear-reminder", "x", "quiet") : ""}</div><p class="small-caption">Calendar reminders can alert you even when Copilot is closed.</p></form>`;
  if (detailTab === "about")
    body = `<section class="detail-section"><div class="detail-label">How you know each other</div><p class="detail-memory">${esc(c.memory || "A short memory makes the next message easier.")}</p><div class="row" style="margin-top:16px">${btn("Edit context", "edit-person", "pencil", "quiet", `data-id="${c.id}"`)}</div></section>${groups.map((g) => `<section><div class="detail-label">${esc(g.name)} · Shared memory</div><p class="detail-memory">${esc(g.memory || "No shared memory yet.")}</p></section>`).join("")}<section class="detail-section stack"><div class="between"><span class="muted">Last hello</span><span>${relative(c.lastContactAt)}</span></div><div class="between"><span class="muted">Keep in touch</span><span>Every ${c.cadence} days</span></div><div class="between"><span class="muted">Added via</span><span>${esc(c.source)}</span></div></section><div class="detail-actions">${btn(c.archived ? "Restore person" : "Archive person", "archive", "archive", "quiet", `data-id="${c.id}"`)}${dateValue(c.snoozedUntil) > Date.now() ? btn("Unsnooze", "unsnooze", "rotate-ccw", "quiet", `data-id="${c.id}"`) : ""}</div>`;
  const html = `<div class="detail-backdrop"><section class="detail" role="dialog" aria-modal="true" aria-label="${esc(c.name)}">${header}<div class="detail-body">${body}</div></section></div>`;
  if (first) openOverlay(html);
  else {
    overlay.innerHTML = html;
    icons();
  }
  paintDraftStatus();
  paintDraftGeneration();
  paintSentStatus();
  const replyForm = $("#reply-form");
  if (replyForm) {
    replyForm.dataset.contactId = c.id;
    const saved = replyBuffer.values(workspace(), c.id);
    replyForm.elements.text.value = saved.text;
    replyForm.elements.direction.value = saved.direction;
    const status = document.createElement("p");
    status.className = "small-caption reply-save-status";
    status.id = "reply-save-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    replyForm.append(status);
    replyForm.elements.text.setAttribute("aria-describedby", status.id);
    paintReplyStatus();
    const field = focus && replyForm.elements.namedItem(focus.name);
    if (field) {
      field.focus({ preventScroll: true });
      if (typeof focus.start === "number")
        field.setSelectionRange(focus.start, focus.end);
      field.scrollTop = focus.scroll;
    }
  }
}
function localDate(value) {
  if (!dateValue(value)) return "";
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
function personForm(id) {
  const c = data.contacts.find((c) => c.id === id) || {
    circleIds: [],
    cadence: 60,
  };
  const cadence = Math.max(7, Math.min(365, Number(c.cadence) || 60));
  const rhythms = [...new Set([14, 30, 60, 90, 180, 365, cadence])].sort(
    (a, b) => a - b,
  );
  modalName = "person";
  modal(
    c.id ? "Edit relationship" : "Add someone to your corner",
    `<form id="person-form" data-id="${c.id || ""}" class="form-stack"><label>Name<input name="name" value="${esc(c.name)}" placeholder="Their name" maxlength="120" required></label><div class="field-grid"><label>Current company<input name="company" value="${esc(c.company)}" maxlength="150" placeholder="Where they work now"></label><label>Role<input name="role" value="${esc(c.role)}" maxlength="200" placeholder="What they do"></label></div><label>LinkedIn profile<input name="url" type="url" value="${esc(c.url)}" placeholder="https://www.linkedin.com/in/..." maxlength="500"></label><label>How do you know each other?<textarea name="memory" placeholder="We worked together on..." maxlength="4000">${esc(c.memory)}</textarea></label><label>A reason to say hello<input name="reason" value="${esc(c.reason)}" maxlength="1000" placeholder="Optional: a shared memory, a question, an update"></label><div class="field-grid"><label>Check-in rhythm<select name="cadence">${rhythms.map((n) => `<option value="${n}" ${cadence === n ? "selected" : ""}>Every ${n} days</option>`).join("")}</select></label><label>Last time you spoke<input name="lastContactAt" type="date" value="${c.lastContactAt ? localDate(c.lastContactAt).slice(0, 10) : ""}"></label></div><fieldset style="border:0;padding:0;margin:0"><legend class="detail-label">Circles</legend><div class="row wrap">${data.circles.map((g) => `<label class="checkbox-row"><input type="checkbox" name="circleIds" value="${g.id}" ${c.circleIds.includes(g.id) ? "checked" : ""}>${esc(g.name)}</label>`).join("") || "<p>Create a circle later to remember your shared chapter.</p>"}</div></fieldset><div class="form-actions">${btn("Cancel", "close", "", "quiet")}<button class="button primary" type="submit">${i("check")}Save person</button></div></form>`,
  );
  const form = $("#person-form");
  form
    .querySelector(".form-actions")
    .insertAdjacentHTML(
      "beforebegin",
      '<p class="small-caption" role="status" aria-live="polite"></p>',
    );
  personForms.set(form, {
    initial: personFormValues(new FormData(form)),
    unconfirmed: new Set(),
  });
}
function circleForm(id) {
  const g = data.circles.find((g) => g.id === id) || { color: "green" };
  activeColor = g.color;
  modalName = "circle";
  modal(
    g.id ? "Edit circle" : "A shared chapter",
    `<form id="circle-form" data-id="${g.id || ""}" class="form-stack"><label>Circle name<input name="name" value="${esc(g.name)}" placeholder="Square crew, NYU friends..." maxlength="100" required></label><label>What connects you?<textarea name="memory" placeholder="The team, the years, the things you worked on together..." maxlength="4000">${esc(g.memory)}</textarea><small>Shared context stays with the circle even when someone changes companies.</small></label><div><div class="detail-label">Color</div><div class="color-picker">${tones.map((color) => `<button type="button" class="swatch ${color} ${color === g.color ? "selected" : ""}" data-action="color" data-id="${color}" title="${color}" aria-label="${color}" aria-pressed="${color === g.color}"></button>`).join("")}</div></div><fieldset style="border:0;padding:0;margin:0"><legend class="detail-label">People in this circle</legend><div class="stack" style="max-height:200px;overflow:auto">${
      active()
        .map(
          (c) =>
            `<label class="checkbox-row"><input type="checkbox" name="members" value="${c.id}" ${c.circleIds.includes(g.id) ? "checked" : ""}>${esc(c.name)}</label>`,
        )
        .join("") ||
      "<p>Add people first, then bring them into this circle.</p>"
    }</div></fieldset><div class="form-actions">${btn("Cancel", "close", "", "quiet")}<button class="button primary" type="submit">${i("check")}Save circle</button></div></form>`,
  );
}
let importAttempt;
function importModal(paste = false) {
  modalName = "import";
  stagedImport = null;
  modal(
    "Bring your people along",
    `<div class="stack">${paste ? `<label>Paste CSV or spreadsheet rows<textarea id="paste-content" rows="7" placeholder="Name,Company,Role,URL&#10;Maya Patel,Stripe,Product Manager,"></textarea></label>${btn("Preview contacts", "preview-paste", "arrow-right", "primary")}` : `<label class="dropzone" id="dropzone">${i("upload")}<strong>Choose a file or drop it here</strong><p>LinkedIn ZIP, CSV, or Copilot backup · Up to 20 MB</p><input type="file" id="import-file" accept=".csv,.zip,.json" aria-label="Choose contact file"></label><p>We'll show you what we found before anything is saved. Existing notes and circles are preserved.</p>${btn("Paste rows instead", "paste", "clipboard", "quiet")}`}<div id="import-preview"></div></div>`,
  );
}
async function prepareImport(read) {
  const preview = $("#import-preview");
  const attempt = (importAttempt = Symbol());
  stagedImport = null;
  preview.innerHTML = '<p role="status">Checking your file...</p>';
  try {
    const result = await read();
    if (attempt === importAttempt && preview.isConnected) previewImport(result);
  } catch (error) {
    if (attempt === importAttempt && preview.isConnected)
      preview.innerHTML = `<div class="notice error" role="alert">${esc(error.message)}</div>`;
  }
}
function previewImport(result) {
  stagedImport = result;
  const merged = mergeContacts(data.contacts, result.contacts);
  $("#import-preview").innerHTML =
    `<div class="notice">${merged.added} new people · ${merged.updated} matches to update${result.warnings.length ? ` · ${result.warnings.length} rows skipped` : ""}</div>${result.kind === "backup" ? `<p>This backup includes ${result.messages.length} saved ${result.messages.length === 1 ? "message" : "messages"} and ${result.circles.length} ${result.circles.length === 1 ? "circle" : "circles"}${result.settings ? ", plus your name, weekly goal, and writing preferences" : ""}. Existing notes, drafts, circles, and saved messages are kept. Your notification preference stays unchanged.</p>` : ""}${demo ? '<p class="small-caption">Demo only: this import stays in this browser. Your private workspace will not change.</p>' : ""}<div class="preview-list">${result.contacts
      .slice(0, 8)
      .map(
        (c) =>
          `<div class="preview-row"><span>${esc(c.name)}</span><small>${esc(c.company)}</small></div>`,
      )
      .join(
        "",
      )}</div>${result.contacts.length > 8 ? `<p>And ${result.contacts.length - 8} more.</p>` : ""}<label>Add new people to a circle<select id="import-circle"><option value="">No circle yet</option>${data.circles.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select></label><div id="import-save-error" role="alert"></div><div class="form-actions">${btn(result.kind === "backup" ? "Restore backup" : "Import contacts", "confirm-import", "check", "primary")}</div>`;
  icons();
}
function linkedInHelp() {
  modal(
    "An assistant for the handoff",
    `<div class="stack"><div class="notice">An option to explore, not an active connection. No agent has been started.</div><p>A personal agent could help request LinkedIn's official archive, wait for it, and prepare the contacts for import. It would not unlock real-time messages.</p><h3>You stay in control</h3><p>You sign in and complete verification yourself. Some browsers or LinkedIn may block automated steps; file upload may still need you. An agent should stop at a block, not work around it.</p><h3>Keep the handoff narrow</h3><p>Use Connections only. Approve the destination and preview before saving. No inbox scraping, passwords in chat, automated messages, or raw archives in GitHub.</p><div class="row wrap">${btn("Copy assistant brief", "agent-brief", "copy", "primary")}${btn("Done", "close", "check", "quiet")}</div></div>`,
  );
}
function download(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function loginView() {
  app.innerHTML = `<main class="login"><img src="/favicon.svg" alt=""><h1>Your people.<br>Your private space.</h1><p>Sign in to open Relationship Copilot.</p>${loginInfo?.signIn ? `<a class="button primary" href="${esc(loginInfo.signIn)}" target="_top">Sign in ${i("arrow-right")}</a>` : `<form id="login-form"><label>Workspace password<input name="password" type="password" autocomplete="current-password" required></label><button class="button primary">Open workspace</button></form>`}${btn("Explore demo", "demo", "sparkles", "quiet")}</main>`;
  icons();
}
async function boot() {
  if (demo) {
    try {
      data = JSON.parse(localStorage.getItem("rc-demo-v2")) || demoState();
    } catch {
      data = demoState();
    }
    render();
    return;
  }
  try {
    await refresh();
  } catch (e) {
    if (loginInfo) loginView();
    else {
      loadError = e.message;
      render();
    }
  }
}
window.addEventListener("hashchange", () => {
  query = "";
  page = 0;
  closeOverlay();
  render();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeOverlay();
    $(".sidebar")?.classList.remove("open");
  }
  if ((e.metaKey || e.ctrlKey) && e.key === "k") {
    e.preventDefault();
    go("people");
    setTimeout(() => $("#people-search")?.focus(), 40);
  }
  if (e.key === "Tab" && overlay.firstElementChild) {
    const nodes = [
      ...overlay.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]',
      ),
    ].filter((el) => el.offsetParent !== null);
    const first = nodes[0],
      last = nodes.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
document.addEventListener("input", (e) => {
  const replyForm = e.target.closest("#reply-form");
  if (replyForm) {
    replyBuffer.stage(workspace(), replyForm.dataset.contactId, {
      text: replyForm.elements.text.value,
      direction: replyForm.elements.direction.value,
    });
    paintReplyStatus();
  }
  if (e.target.id === "people-search") {
    query = e.target.value;
    page = 0;
    $("#people-results").innerHTML = peopleTable();
    icons();
  }
  if (e.target.id === "draft-text") {
    const id = selected,
      value = e.target.value;
    drafts.set(id, value);
    draftJobs.invalidate(id);
    $("#word-count").textContent =
      `${value.trim() ? value.trim().split(/\s+/).length : 0} words`;
    clearTimeout(saveTimer);
    draftSaver.stage(id, value);
    saveTimer = setTimeout(async () => {
      try {
        await flushDraft();
      } catch (e) {
        notify(
          "Draft couldn't save. Keep this tab open. You can still copy it or retry saving.",
          true,
        );
      }
    }, 500);
  }
});
document.addEventListener("change", async (e) => {
  try {
    if (e.target.id === "people-filter") {
      filter = e.target.value;
      page = 0;
      $("#people-results").innerHTML = peopleTable();
      icons();
    }
    if (e.target.id === "circle-filter") {
      circleFilter = e.target.value;
      page = 0;
      render();
    }
    if (e.target.id === "draft-intent") {
      intent = e.target.value;
      draftJobs.invalidate(selected);
    }
    if (e.target.id === "import-file" && e.target.files[0])
      await prepareImport(() => importFile(e.target.files[0]));
  } catch (e) {
    notify(e.message, true);
  }
});
document.addEventListener("dragover", (e) => {
  if (e.target.closest("#dropzone")) {
    e.preventDefault();
    $("#dropzone").classList.add("drag");
  }
});
document.addEventListener("dragleave", (e) => {
  if (e.target.closest("#dropzone")) $("#dropzone").classList.remove("drag");
});
document.addEventListener("drop", async (e) => {
  if (e.target.closest("#dropzone")) {
    e.preventDefault();
    $("#dropzone").classList.remove("drag");
    try {
      if (e.dataTransfer.files[0])
        await prepareImport(() => importFile(e.dataTransfer.files[0]));
    } catch (err) {
      notify(err.message, true);
    }
  }
});
document.addEventListener("click", async (e) => {
  const target = e.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action,
    id = target.dataset.id;
  const replyFormToSubmit =
    action === "submit-reply" ? target.closest("form") : null;
  const c = selectedContact();
  e.preventDefault();
  if (target.disabled) return;
  if (action === "mark-sent" && sentDrafts.has(c?.id)) return;
  // Capture before awaiting autosave; the drawer and its text can change meanwhile.
  const sentDraft =
    action === "mark-sent" && c
      ? {
          field: $("#draft-text"),
          value: $("#draft-text")?.value || "",
          revision: draftSaver.revision(c.id),
        }
      : null;
  if (sentDraft) {
    sentDrafts.set(c.id, sentDraft);
    draftJobs.invalidate(c.id);
  }
  const draftJob = action === "draft" && c ? draftJobs.begin(c.id) : null;
  const requestedIntent = intent;
  if (action === "draft" && !draftJob) return;
  target.disabled = true;
  try {
    if (
      ["demo", "exit-demo", "confirm-import"].includes(action) &&
      pendingPersonForms.size
    )
      throw new Error(
        "Wait for this person to finish saving before switching workspaces or importing.",
      );
    if (draftJob) paintDraftGeneration();
    if (sentDraft) paintSentStatus();
    if (["demo", "exit-demo"].includes(action) && replyBuffer.hasUnsaved()) {
      openPerson(replyBuffer.firstUnsaved(workspace()), "conversation");
      throw new Error(
        "Save or clear this message before switching workspaces.",
      );
    }
    if (action === "confirm-import" && replyBuffer.hasPending())
      throw new Error(
        "Wait for your message to finish saving before importing.",
      );
    if (
      ["demo", "exit-demo", "confirm-import"].includes(action) &&
      (messageRecorder.hasPending() || sentDrafts.size)
    )
      throw new Error(
        "Wait for your message to finish saving before switching workspaces or importing.",
      );
    // Reading and copying must not depend on the save service being available.
    const readOnly = [
      "copy",
      "close",
      "person",
      "conversation",
      "detail-tab",
      "reply-draft",
      "people",
      "connections",
      "menu",
      "search",
      "next",
      "prev",
      "inbox-filter",
      "circle-people",
      "linkedin-help",
      "ranking-info",
    ];
    if (!readOnly.includes(action)) await flushDraft();
    if (draftJob && !draftJobs.isCurrent(draftJob)) return;
    if (["people", "connections"].includes(action)) go(action);
    else if (action === "retry-draft") {
      notify("Drafts saved.");
      $("#draft-text")?.focus({ preventScroll: true });
    } else if (action === "menu") $(".sidebar").classList.toggle("open");
    else if (action === "search") {
      go("people");
      setTimeout(() => $("#people-search")?.focus(), 40);
    } else if (action === "reload") await refresh();
    else if (action === "close") closeOverlay();
    else if (action === "demo") {
      draftJobs.reset();
      demo = true;
      drafts.clear();
      variants.clear();
      loginInfo = null;
      data = demoState();
      persistDemo();
      history.replaceState(null, "", "?demo=1#today");
      closeOverlay();
      render();
    } else if (action === "exit-demo") {
      draftJobs.reset();
      demo = false;
      drafts.clear();
      variants.clear();
      closeOverlay();
      history.replaceState(null, "", "/#today");
      await boot();
    } else if (action === "add-person") personForm();
    else if (action === "edit-person") personForm(id || selected);
    else if (action === "new-circle") circleForm();
    else if (action === "edit-circle") circleForm(id);
    else if (action === "color") {
      activeColor = id;
      overlay.querySelectorAll(".swatch").forEach((b) => {
        b.classList.toggle("selected", b.dataset.id === id);
        b.setAttribute("aria-pressed", String(b.dataset.id === id));
      });
    } else if (action === "circle-people") {
      circleFilter = id;
      filter = "all";
      query = "";
      go("people");
    } else if (action === "person" || action === "conversation")
      openPerson(id, action === "conversation" ? "conversation" : "draft");
    else if (action === "detail-tab") {
      detailTab = id;
      drawDetail();
    } else if (action === "favorite") {
      await updateContact(id, {
        favorite: !data.contacts.find((c) => c.id === id).favorite,
      });
      drawDetail();
    } else if (action === "snooze") {
      const person = data.contacts.find((c) => c.id === (id || selected));
      const old = person.snoozedUntil;
      await updateContact(person.id, {
        snoozedUntil: new Date(Date.now() + 7 * DAY).toISOString(),
      });
      if (selected) closeOverlay();
      notify(`${person.name.split(" ")[0]} is snoozed for a week.`, false, () =>
        updateContact(person.id, { snoozedUntil: old }),
      );
    } else if (action === "unsnooze") {
      await updateContact(id, { snoozedUntil: "" });
      drawDetail();
      notify("Back in your weekly suggestions.");
    } else if (action === "archive") {
      await updateContact(id, { archived: !c.archived });
      closeOverlay();
      notify(
        c.archived
          ? "Person restored."
          : "Person archived. Their history is still saved.",
        false,
        () => updateContact(id, { archived: c.archived }),
      );
    } else if (action === "undo") {
      if (undoAction) await undoAction();
      $("#toast").replaceChildren();
    } else if (action === "next" || action === "prev") {
      page += action === "next" ? 1 : -1;
      $("#people-results").innerHTML = peopleTable();
      icons();
    } else if (action === "inbox-filter") {
      inboxFilter = id;
      render();
    } else if (action === "import" || action === "paste")
      importModal(action === "paste");
    else if (action === "preview-paste")
      await prepareImport(() => parseContacts($("#paste-content").value));
    else if (action === "confirm-import") {
      if (!stagedImport) throw new Error("Choose a contact file first.");
      draftJobs.reset();
      const group = $("#import-circle")?.value;
      const incoming = stagedImport.contacts.map((c) => ({
        ...c,
        circleIds: group ? [...new Set([...c.circleIds, group])] : c.circleIds,
      }));
      let result;
      if (demo) {
        result = mergeDemoImport(data, { ...stagedImport, contacts: incoming });
        try {
          localStorage.setItem("rc-demo-v2", JSON.stringify(result.state));
        } catch {
          throw new Error(
            "This browser couldn't save the import. Nothing was imported. Free some browser storage and try again.",
          );
        }
        data = result.state;
      } else {
        result = await request("/api/import", "POST", {
          ...stagedImport,
          contacts: incoming,
        });
        await refresh(false);
      }
      closeOverlay();
      circleFilter = "all";
      go("people");
      render();
      notify(
        `${result.added} people added. ${result.updated} existing contacts updated.`,
      );
    } else if (action === "migrate") {
      importModal();
      const old = JSON.parse(
          localStorage.getItem("relationship-copilot-contacts") || "[]",
        ),
        mem = JSON.parse(
          localStorage.getItem("relationship-copilot-clusters") || "{}",
        );
      previewImport(
        parseBackup(
          JSON.stringify(
            old.map((c) => ({
              ...c,
              clusterNote: mem[c.cluster] || c.clusterNote,
            })),
          ),
        ),
      );
    } else if (action === "export") {
      download(
        JSON.stringify(
          {
            version: 2,
            exportedAt: nowISO(),
            contacts: data.contacts,
            circles: data.circles,
            messages: data.messages,
            settings: data.settings,
          },
          null,
          2,
        ),
        "relationship-copilot-backup.json",
        "application/json",
      );
      notify("Backup downloaded. Keep it somewhere private.");
    } else if (action === "draft") {
      const contactId = c.id;
      let result;
      if (demo)
        result = {
          mode: "starter",
          drafts: [
            fallbackDraft(c, requestedIntent, 0),
            fallbackDraft(c, requestedIntent, 1),
          ],
          grounding: "Demo starter, written locally. Add a personal detail.",
          needsReview: true,
        };
      else
        result = await request("/api/draft", "POST", {
          contactId,
          intent: requestedIntent,
        });
      if (!draftJobs.isCurrent(draftJob)) return;
      variants.set(contactId, result);
      drafts.set(contactId, result.drafts[0]);
      draftSaver.stage(contactId, result.drafts[0]);
      if (selected === contactId && detailTab === "draft") drawDetail();
      await flushDraft();
    } else if (action === "variant") {
      draftJobs.invalidate(c.id);
      const value = variants.get(c.id).drafts[Number(id)];
      drafts.set(c.id, value);
      draftSaver.stage(c.id, value);
      drawDetail();
      await flushDraft();
    } else if (action === "copy") {
      const value = $("#draft-text").value;
      if (!value.trim()) throw new Error("Write a message first.");
      await navigator.clipboard.writeText(value);
      notify("Copied. Give it one last read before sending.");
    } else if (action === "mark-sent") {
      const value = sentDraft?.value.trim();
      if (!value) throw new Error("Write a message first.");
      let recorded = false;
      try {
        const current = data.contacts.find((person) => person.id === c.id);
        const expectedDraftVersion =
          draftSaver.revision(c.id) === sentDraft.revision
            ? (current.draftVersion ?? "")
            : undefined;
        await addMessage(c, value, "out", expectedDraftVersion);
        recorded = true;
      } finally {
        const changed = draftSaver.revision(c.id) !== sentDraft.revision;
        // The server clears only the saved version that was sent. Never issue
        // a cleanup PATCH that could overwrite another window's newer draft.
        if (changed) {
          await flushDraft();
        } else if (recorded) {
          const next = data.contacts.find((person) => person.id === c.id).draft;
          drafts.set(c.id, next);
          if (selected === c.id && detailTab === "draft") {
            $("#draft-text").value = next;
            $("#word-count").textContent =
              `${next.trim() ? next.trim().split(/\s+/).length : 0} words`;
            paintDraftStatus();
          }
          if (!next && sentDraft.field.isConnected && selected === c.id)
            closeOverlay();
        }
      }
      render();
      notify(`A little closer to ${c.name.split(" ")[0]}.`);
    } else if (action === "reply-draft") {
      detailTab = "draft";
      intent = "reply";
      drawDetail();
    } else if (action === "resolve") {
      await updateContact(c.id, { needsReply: false, reminderAt: "" });
      drawDetail();
      notify("Conversation cleared from your reply queue.");
    } else if (action === "clear-reminder") {
      await updateContact(c.id, { reminderAt: "" });
      drawDetail();
      notify("Reminder cleared.");
    } else if (action === "calendar") {
      const when =
        overlay.querySelector('[name="reminderAt"]')?.value || c.reminderAt;
      download(reminderCalendar(c, when), "catch-up.ics", "text/calendar");
      notify("Open the calendar file to add your reminder.");
    } else if (action === "submit-reply") {
      if (replyFormToSubmit?.isConnected) replyFormToSubmit.requestSubmit();
    } else if (action === "submit-reminder")
      $("#reminder-form").requestSubmit();
    else if (action === "submit-settings") $("#settings-form").requestSubmit();
    else if (action === "linkedin-help") linkedInHelp();
    else if (action === "agent-brief") {
      await navigator.clipboard.writeText(
        "Help me bring my LinkedIn connections into my private Relationship Copilot app. First confirm the destination with me. Use only LinkedIn's official Download your data flow, requesting Connections only. Let me sign in and complete verification privately. Do not scrape profiles or messages, send messages, or bypass any restriction. Tell me if a download or upload needs my help. When the archive is ready, inspect only Connections.csv, show the import preview, and ask before saving it to the confirmed workspace. Do not put personal data or the raw archive in GitHub. This is a one-time import, not permission for ongoing monitoring.",
      );
      notify("Assistant brief copied. No agent has been started.");
    } else if (action === "ranking-info")
      modal(
        "Why these people?",
        `<div class="stack"><p>Suggestions use your check-in rhythm, time since your last message, relationship notes, and close-connection stars.</p><p>Recent conversations and snoozed people stay out of this list. Replies waiting on you go to Inbox.</p><p>These are transparent local suggestions, not AI predictions about someone's willingness to respond. AI is used separately when you ask for a message draft.</p>${btn("Got it", "close", "check", "primary")}</div>`,
      );
  } catch (error) {
    if (draftJob && !draftJobs.isCurrent(draftJob)) return;
    if (action === "confirm-import" && $("#import-save-error")) {
      $("#import-save-error").className = "notice error";
      $("#import-save-error").textContent = error.message;
      return;
    }
    notify(
      error.name === "TimeoutError"
        ? "That took too long. Please try again."
        : error.message,
      true,
    );
  } finally {
    if (sentDraft) sentDrafts.delete(c.id);
    if (draftJob) {
      draftJobs.finish(draftJob);
      paintDraftGeneration();
    } else if (target.isConnected) target.disabled = false;
    paintSentStatus();
    paintReplyStatus();
  }
});
document.addEventListener("submit", async (e) => {
  const form = e.target;
  if (
    ![
      "person-form",
      "circle-form",
      "reply-form",
      "reminder-form",
      "settings-form",
      "login-form",
    ].includes(form.id)
  )
    return;
  e.preventDefault();
  if (pendingPersonForms.has(form)) return;
  const f = new FormData(form),
    values = Object.fromEntries(f.entries());
  const replyJob =
    form.id === "reply-form"
      ? replyBuffer.begin(workspace(), form.dataset.contactId, values)
      : null;
  if (form.id === "reply-form" && !replyJob) return;
  const button =
    form.querySelector('[type="submit"]') || form.querySelector("button");
  if (button) button.disabled = true;
  const personStatus =
    form.id === "person-form" ? form.querySelector('[role="status"]') : null;
  if (personStatus) {
    pendingPersonForms.add(form);
    form.setAttribute("aria-busy", "true");
    button.setAttribute("aria-busy", "true");
    personStatus.classList.remove("save-error");
    personStatus.textContent = "Saving...";
  }
  paintReplyStatus();
  try {
    if (form.id === "login-form") {
      await request("/api/login", "POST", values);
      loginInfo = null;
      await refresh();
    }
    if (form.id === "person-form") {
      const editing = Boolean(form.dataset.id),
        formState = personForms.get(form),
        current = personFormValues(f);
      if (
        !formState ||
        (editing && !data.contacts.some((c) => c.id === form.dataset.id))
      )
        throw new Error("Reopen this person before saving.");
      const body = editing
        ? changedPersonFields(formState.initial, current, formState.unconfirmed)
        : current;
      if (
        values.url &&
        !/^https:\/\/(www\.)?linkedin\.com\/in\//i.test(values.url)
      )
        throw new Error(
          "Use a LinkedIn profile URL beginning https://www.linkedin.com/in/.",
        );
      if (editing) {
        if (Object.keys(body).length) {
          draftJobs.invalidate(form.dataset.id);
          for (const key of Object.keys(body)) formState.unconfirmed.add(key);
          await updateContact(form.dataset.id, body, { paint: false });
        } else await refresh(false);
      } else {
        const created = demo
          ? normalizeContact(body)
          : await request("/api/contacts", "POST", body);
        // A background refresh may already contain this creation and newer edits.
        if (!data.contacts.some((contact) => contact.id === created.id))
          data.contacts.push(created);
        if (demo) persistDemo();
        // Continued typing after creation must update this person, not create another.
        form.dataset.id = created.id;
      }
      formState.initial = current;
      formState.unconfirmed.clear();
      const hasNewerChanges =
        form.isConnected &&
        Object.keys(
          changedPersonFields(current, personFormValues(new FormData(form))),
        ).length > 0;
      if (form.isConnected) {
        if (hasNewerChanges)
          personStatus.textContent =
            "Saved. Your newer changes still need saving.";
        else closeOverlay();
      }
      render();
      if (!hasNewerChanges)
        notify(
          editing
            ? Object.keys(body).length
              ? "Relationship updated."
              : "No changes to save."
            : "One more person in your corner.",
        );
    }
    if (form.id === "circle-form") {
      const old = data.circles.find((g) => g.id === form.dataset.id),
        body = { name: values.name, memory: values.memory, color: activeColor };
      const g = demo
        ? normalizeCircle({ ...body, id: old?.id })
        : await request(
            old ? `/api/circles/${old.id}` : "/api/circles",
            old ? "PUT" : "POST",
            body,
          );
      data.circles = old
        ? data.circles.map((x) => (x.id === g.id ? g : x))
        : [...data.circles, g];
      const members = f.getAll("members");
      for (const c of active())
        if (members.includes(c.id) !== c.circleIds.includes(g.id))
          await updateContact(
            c.id,
            {
              circleIds: members.includes(c.id)
                ? [...c.circleIds, g.id]
                : c.circleIds.filter((x) => x !== g.id),
            },
            { paint: false },
          );
      if (demo) persistDemo();
      closeOverlay();
      render();
      notify("Circle saved. Your shared chapter stays with you.");
    }
    if (form.id === "reply-form") {
      const person = data.contacts.find((c) => c.id === replyJob.contactId);
      draftJobs.invalidate(person.id);
      await addMessage(person, replyJob.values.text, replyJob.values.direction);
      replyBuffer.finish(replyJob, true);
      render();
      if (selected === person.id && detailTab === "conversation") drawDetail();
      notify(
        values.direction === "in"
          ? "Reply saved. It's in your reply queue."
          : "Message saved.",
      );
    }
    if (form.id === "reminder-form") {
      if (dateValue(values.reminderAt) <= Date.now())
        throw new Error("Choose a time in the future.");
      await updateContact(selected, {
        reminderAt: new Date(values.reminderAt).toISOString(),
      });
      drawDetail();
      notify(
        "Reminder set. Add it to your calendar for alerts while the app is closed.",
      );
    }
    if (form.id === "settings-form") {
      let notifications = f.has("notifications");
      if (notifications) {
        if (!("Notification" in window))
          throw new Error(
            "This browser doesn't support notifications. Use calendar reminders instead.",
          );
        notifications = (await Notification.requestPermission()) === "granted";
      }
      const s = {
        ...values,
        weeklyGoal: Number(values.weeklyGoal),
        notifications,
      };
      data.settings = demo ? s : await request("/api/settings", "PUT", s);
      if (demo) persistDemo();
      render();
      notify("Preferences saved.");
    }
  } catch (error) {
    if (replyJob) replyBuffer.finish(replyJob, false);
    if (personStatus && form.isConnected) {
      personStatus.textContent =
        "Save not confirmed. Your changes are still here.";
      personStatus.classList.add("save-error");
    }
    notify(error.message, true);
  } finally {
    pendingPersonForms.delete(form);
    if (personStatus) {
      form.setAttribute("aria-busy", "false");
      button.setAttribute("aria-busy", "false");
    }
    if (button?.isConnected) button.disabled = false;
    paintReplyStatus();
  }
});
const notified = new Set();
setInterval(async () => {
  if (document.hidden) return;
  if (
    !demo &&
    !overlay.firstElementChild &&
    !document.activeElement?.matches("input,textarea,select")
  )
    try {
      const before = JSON.stringify(data);
      await refresh(false);
      if (before !== JSON.stringify(data)) render();
    } catch {
      /* Keep the current screen usable during temporary outages. */
    }
  if (
    data.settings.notifications &&
    "Notification" in window &&
    Notification.permission === "granted"
  )
    for (const c of active())
      if (
        dateValue(c.reminderAt) &&
        dateValue(c.reminderAt) <= Date.now() &&
        !notified.has(c.id + c.reminderAt)
      ) {
        new Notification(`A little hello for ${c.name}`, {
          body: "Your follow-up reminder is due.",
          tag: c.id,
        });
        notified.add(c.id + c.reminderAt);
      }
}, 30000);
await boot();
