const subjects = [
  { name: "Calculus", lesson: "Integration techniques", progress: 72, icon: "∫", tone: "#eeeaff", description: "Master substitution, parts, and definite integrals." },
  { name: "Modern History", lesson: "The French Revolution", progress: 48, icon: "♜", tone: "#ffede5", description: "Connect people, events, and the ideas that shaped them." },
  { name: "Biology", lesson: "Cellular respiration", progress: 31, icon: "⌬", tone: "#e5f5ed", description: "Follow how cells turn fuel into usable energy." },
  { name: "French", lesson: "Conversational past tense", progress: 65, icon: "À", tone: "#fff4c9", description: "Practise confidently using the passé composé." },
  { name: "Literature", lesson: "Close reading", progress: 22, icon: "¶", tone: "#e7f0ff", description: "Build stronger interpretations from the text." },
];

const topicList = document.querySelector("#topicList");
const subjectGrid = document.querySelector("#subjectGrid");
const toast = document.querySelector("#toast");
let currentSubject = subjects[0];

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function renderSubjects() {
  topicList.innerHTML = subjects.slice(0, 3).map((subject) => `
    <article class="topic" data-subject="${subject.name}">
      <span class="topic-icon" style="background:${subject.tone}">${subject.icon}</span>
      <div><strong>${subject.name}</strong><p>${subject.lesson}</p></div><span class="topic-arrow">→</span>
    </article>`).join("");
  subjectGrid.innerHTML = subjects.map((subject) => `
    <article class="panel subject-card" data-subject="${subject.name}">
      <div class="subject-top"><span class="subject-icon" style="background:${subject.tone}">${subject.icon}</span><span class="pill">${subject.progress}% complete</span></div>
      <h2>${subject.name}</h2><p>${subject.lesson}</p>
      <div class="subject-progress"><div><span style="width:${subject.progress}%"></span></div>${subject.progress}%</div>
    </article>`).join("");
  document.querySelectorAll("[data-subject]").forEach((item) => item.addEventListener("click", () => openSubject(item.dataset.subject)));
}

function openSubject(name) {
  currentSubject = subjects.find((subject) => subject.name === name) || subjects[0];
  document.querySelector("#workspaceLabel").textContent = `${currentSubject.name.toUpperCase()} · ${currentSubject.progress}% COMPLETE`;
  document.querySelector("#workspaceTitle").textContent = currentSubject.name;
  document.querySelector("#workspaceDescription").textContent = currentSubject.description;
  document.querySelector("#sessionTitle").textContent = currentSubject.lesson;
  document.querySelector("#sessionSteps").innerHTML = ["Review the key idea (10 min)", "Work through a guided example (15 min)", "Try two practice questions (15 min)", "Write a one-sentence takeaway (5 min)"].map((step) => `<li>${step}</li>`).join("");
  document.querySelector("#notes").value = localStorage.getItem(`vanes-notes-${name}`) || "";
  switchView("workspace");
}

function switchView(viewId) {
  document.querySelectorAll(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-link").forEach((link) => link.classList.toggle("active", link.dataset.view === viewId));
  document.querySelector(".sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-view]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); switchView(link.dataset.view); }));
document.querySelectorAll("[data-view-target]").forEach((button) => button.addEventListener("click", () => switchView(button.dataset.viewTarget)));
document.querySelector("#mobileMenu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));

document.querySelector("#newSubject").addEventListener("click", () => {
  const name = window.prompt("What subject would you like to add?");
  if (!name?.trim()) return;
  subjects.push({ name: name.trim(), lesson: "Start your first focused session", progress: 0, icon: "✦", tone: "#eeeaff", description: `Build a calm, consistent learning routine for ${name.trim()}.` });
  renderSubjects();
  showToast(`${name.trim()} has been added to your library.`);
});

document.querySelector("#planForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = data.get("subject"); const time = Number(data.get("time")); const goal = data.get("goal");
  const review = Math.max(5, Math.round(time * .2)); const practise = Math.max(10, Math.round(time * .45)); const reflect = time - review - practise;
  const result = document.querySelector("#planResult");
  result.classList.add("generated");
  result.innerHTML = `<p class="eyebrow">${time}-MINUTE FOCUS SESSION</p><h2>${subject}</h2><p>Goal: ${goal.toLowerCase()}.</p><ul><li><strong>${review} min — Warm up:</strong> recall what you already know and list one question.</li><li><strong>${practise} min — Deep work:</strong> learn one core idea and apply it to an example.</li><li><strong>${reflect} min — Lock it in:</strong> summarise the idea without looking at your notes.</li></ul><button class="primary-button" id="startPlan">Start this session →</button>`;
  document.querySelector("#startPlan").addEventListener("click", () => { openSubject(subject); showToast("Your focused session is ready."); });
});

function coachReply(question) {
  const topic = question.replace(/[?!.]/g, "").slice(0, 80);
  if (/practice|question|quiz/i.test(question)) return `Try this: explain ${topic.replace(/give me a /i, "")} in three sentences, then name one detail that supports your answer. Check: can you explain why that detail matters?`;
  if (/plan|study|exam/i.test(question)) return `Let's make this manageable. Start with a 10-minute recall dump, spend 25 minutes on the most unfamiliar idea, then use the final 10 minutes to test yourself. What topic feels least certain right now?`;
  return `A helpful way to approach “${topic}” is to begin with the big picture, identify the two or three essential terms, and connect them with an example. Try explaining it aloud as if you were teaching a friend. Where does the explanation feel fuzzy?`;
}

function appendMessage(text, user = false) {
  const message = document.createElement("div");
  message.className = `message ${user ? "user-message" : "coach-message"}`;
  message.innerHTML = user ? `<p></p>` : `<span>✦</span><p></p>`;
  message.querySelector("p").textContent = text;
  document.querySelector("#messages").append(message);
  message.scrollIntoView({ behavior: "smooth", block: "end" });
}

function sendCoachMessage(text) { if (!text.trim()) return; appendMessage(text, true); window.setTimeout(() => appendMessage(coachReply(text)), 350); }
document.querySelector("#chatForm").addEventListener("submit", (event) => { event.preventDefault(); const input = document.querySelector("#chatInput"); sendCoachMessage(input.value); input.value = ""; });
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => sendCoachMessage(button.dataset.prompt)));

document.querySelector("#notes").addEventListener("input", (event) => { localStorage.setItem(`vanes-notes-${currentSubject.name}`, event.target.value); document.querySelector("#saveStatus").textContent = "Saved just now"; });
document.querySelector("#clearNotes").addEventListener("click", () => { document.querySelector("#notes").value = ""; localStorage.removeItem(`vanes-notes-${currentSubject.name}`); showToast("Notes cleared."); });
document.querySelector("#completeSession").addEventListener("click", () => { currentSubject.progress = Math.min(100, currentSubject.progress + 8); document.querySelector("#progressStat").textContent = "76%"; document.querySelector("#progressBar").style.width = "76%"; renderSubjects(); showToast("Great work — your session is complete!"); });
document.querySelector("#themeToggle").addEventListener("click", () => { document.body.classList.toggle("dark"); showToast("Theme preference updated."); });
renderSubjects();
