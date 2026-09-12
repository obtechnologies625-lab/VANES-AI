// ==============================
// VANES AI — configuration
// ==============================
// Edit these two values with your OpenRouter credentials/model.
// For a production app, keep API keys on a server rather than in browser code.
const OPENROUTER_API_KEY = "YOUR_OPENROUTER_API_KEY_HERE";
const OPENROUTER_MODEL = "openai/gpt-4o-mini";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// A broad Tanzanian secondary-school subject library, including common CSEE/O-Level
// and ACSEE/A-Level subjects. Schools can offer different combinations.
const subjects = [
  { name: "Kiswahili", level: "O-Level", lesson: "Sarufi na matumizi ya lugha", progress: 0, icon: "K", tone: "#e5f5ed", description: "Sarufi, fasihi, mawasiliano, na matumizi sahihi ya Kiswahili." },
  { name: "English Language", level: "O-Level", lesson: "Comprehension and communication", progress: 0, icon: "A", tone: "#e7f0ff", description: "Grammar, comprehension, writing, speaking, and communication skills." },
  { name: "Basic Mathematics", level: "O-Level", lesson: "Algebra and problem solving", progress: 0, icon: "∑", tone: "#eeeaff", description: "Core mathematics, algebra, geometry, statistics, and problem solving." },
  { name: "Basic Applied Mathematics", level: "O-Level", lesson: "Applied mathematical problems", progress: 0, icon: "≈", tone: "#fff4c9", description: "Apply mathematical methods to practical and everyday problems." },
  { name: "Advanced Mathematics", level: "A-Level", lesson: "Calculus and functions", progress: 0, icon: "∫", tone: "#eeeaff", description: "Functions, calculus, algebra, trigonometry, statistics, and advanced problem solving." },
  { name: "History", level: "O-Level", lesson: "Tanzania and world history", progress: 0, icon: "♜", tone: "#ffede5", description: "Analyse people, events, societies, colonialism, independence, and historical change." },
  { name: "Geography", level: "O-Level", lesson: "Physical and human geography", progress: 0, icon: "⌖", tone: "#e5f5ed", description: "Physical processes, resources, population, environment, maps, and human activities." },
  { name: "Chemistry", level: "O-Level", lesson: "Atoms, bonding and reactions", progress: 0, icon: "⚗", tone: "#fff4c9", description: "Matter, atomic structure, bonding, reactions, calculations, and practical chemistry." },
  { name: "Physics", level: "O-Level", lesson: "Mechanics and energy", progress: 0, icon: "ϟ", tone: "#e7f0ff", description: "Mechanics, heat, waves, electricity, magnetism, and modern physics." },
  { name: "Biology", level: "O-Level", lesson: "Cells and life processes", progress: 0, icon: "⌬", tone: "#e5f5ed", description: "Cells, nutrition, reproduction, genetics, ecology, health, and life processes." },
  { name: "Civics", level: "O-Level", lesson: "Citizenship and government", progress: 0, icon: "◎", tone: "#ffede5", description: "Citizenship, democracy, human rights, government, responsibilities, and national values." },
  { name: "Information and Computer Studies", level: "O-Level", lesson: "Computer systems and information", progress: 0, icon: "⌘", tone: "#e7f0ff", description: "Computer systems, information, applications, networks, programming, and digital skills." },
  { name: "Commerce", level: "O-Level", lesson: "Trade and business", progress: 0, icon: "◇", tone: "#fff4c9", description: "Trade, business organisation, finance, insurance, marketing, and commercial practice." },
  { name: "Bookkeeping", level: "O-Level", lesson: "Double-entry bookkeeping", progress: 0, icon: "▤", tone: "#eeeaff", description: "Accounts, journals, ledgers, trial balance, and financial records." },
  { name: "Agriculture", level: "O-Level", lesson: "Crop and livestock production", progress: 0, icon: "⌁", tone: "#e5f5ed", description: "Crop production, livestock, soil, farm management, and sustainable agriculture." },
  { name: "Food and Nutrition", level: "O-Level", lesson: "Nutrition and food preparation", progress: 0, icon: "◌", tone: "#ffede5", description: "Nutrition, meal planning, food preparation, hygiene, and household health." },
  { name: "Fine Art", level: "O-Level", lesson: "Drawing and visual expression", progress: 0, icon: "◒", tone: "#eeeaff", description: "Drawing, painting, design, visual communication, and artistic expression." },
  { name: "Music", level: "O-Level", lesson: "Theory and performance", progress: 0, icon: "♫", tone: "#fff4c9", description: "Music theory, composition, performance, notation, and appreciation." },
  { name: "French", level: "O-Level", lesson: "Communication en français", progress: 0, icon: "À", tone: "#e7f0ff", description: "French vocabulary, grammar, comprehension, writing, and communication." },
  { name: "Arabic", level: "O-Level", lesson: "Arabic language and communication", progress: 0, icon: "ع", tone: "#e5f5ed", description: "Arabic language, comprehension, writing, grammar, and communication." },
  { name: "Bible Knowledge", level: "O-Level", lesson: "Biblical studies", progress: 0, icon: "✝", tone: "#ffede5", description: "Study selected biblical texts, themes, values, and their applications." },
  { name: "Islamic Knowledge", level: "O-Level", lesson: "Qur'an, Hadith and Islamic studies", progress: 0, icon: "☪", tone: "#e5f5ed", description: "Islamic beliefs, Qur'an, Hadith, history, ethics, and religious practice." },
  { name: "Physical Education", level: "O-Level", lesson: "Health, fitness and sport", progress: 0, icon: "●", tone: "#e7f0ff", description: "Fitness, health, movement, sport skills, safety, and physical wellbeing." },
  { name: "Economics", level: "A-Level", lesson: "Microeconomics and macroeconomics", progress: 0, icon: "◈", tone: "#fff4c9", description: "Markets, production, national income, inflation, development, and economic policy." },
  { name: "History", level: "A-Level", lesson: "Advanced historical analysis", progress: 0, icon: "♜", tone: "#ffede5", description: "Advanced analysis of African, Tanzanian, and world historical developments." },
  { name: "Geography", level: "A-Level", lesson: "Advanced physical and human geography", progress: 0, icon: "⌖", tone: "#e5f5ed", description: "Advanced physical geography, human geography, environment, resources, and fieldwork." },
  { name: "Physics", level: "A-Level", lesson: "Mechanics, electricity and waves", progress: 0, icon: "ϟ", tone: "#e7f0ff", description: "Advanced mechanics, thermal physics, waves, electricity, fields, and modern physics." },
  { name: "Chemistry", level: "A-Level", lesson: "Physical, inorganic and organic chemistry", progress: 0, icon: "⚗", tone: "#fff4c9", description: "Advanced chemical theory, calculations, inorganic chemistry, organic chemistry, and practical work." },
  { name: "Biology", level: "A-Level", lesson: "Advanced biological processes", progress: 0, icon: "⌬", tone: "#e5f5ed", description: "Advanced cell biology, genetics, physiology, ecology, evolution, and practical biology." },
  { name: "General Studies", level: "A-Level", lesson: "Critical thinking and current issues", progress: 0, icon: "◎", tone: "#eeeaff", description: "Critical thinking, communication, society, citizenship, science, and contemporary issues." },
  { name: "Computer Science", level: "A-Level", lesson: "Algorithms and programming", progress: 0, icon: "⌘", tone: "#e7f0ff", description: "Programming, algorithms, data structures, systems, databases, and computational thinking." },
  { name: "Accountancy", level: "A-Level", lesson: "Financial accounting", progress: 0, icon: "▤", tone: "#eeeaff", description: "Financial accounting, costing, analysis, reporting, and accounting principles." },
  { name: "Commerce", level: "A-Level", lesson: "Business and commercial systems", progress: 0, icon: "◇", tone: "#fff4c9", description: "Advanced business, trade, marketing, finance, and commercial decision-making." },
  { name: "Economics", level: "O-Level", lesson: "Economic principles", progress: 0, icon: "◈", tone: "#fff4c9", description: "Basic economic concepts, production, markets, trade, and development." },
];

// Remove duplicate subject names while retaining the first entry for navigation.
const uniqueSubjects = Array.from(new Map(subjects.map((subject) => [`${subject.level}:${subject.name}`, subject])).values());

const topicList = document.querySelector("#topicList");
const subjectGrid = document.querySelector("#subjectGrid");
const toast = document.querySelector("#toast");
let currentSubject = uniqueSubjects[0];
let activeFilter = "all";
let selectedImage = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function renderSubjects() {
  const visible = activeFilter === "all" ? uniqueSubjects : uniqueSubjects.filter((subject) => subject.level === activeFilter);
  topicList.innerHTML = uniqueSubjects.slice(0, 3).map((subject) => `
    <article class="topic" data-subject-key="${subject.level}:${subject.name}">
      <span class="topic-icon" style="background:${subject.tone}">${subject.icon}</span>
      <div><strong>${subject.name}</strong><p>${subject.level} · ${subject.lesson}</p></div><span class="topic-arrow">→</span>
    </article>`).join("");
  subjectGrid.innerHTML = visible.map((subject) => `
    <article class="panel subject-card" data-subject-key="${subject.level}:${subject.name}">
      <div class="subject-top"><span class="subject-icon" style="background:${subject.tone}">${subject.icon}</span><span class="pill">${subject.level}</span></div>
      <h2>${subject.name}</h2><p>${subject.lesson}</p>
      <div class="subject-progress"><div><span style="width:${subject.progress}%"></span></div>${subject.progress}%</div>
    </article>`).join("");
  document.querySelectorAll("[data-subject-key]").forEach((item) => item.addEventListener("click", () => openSubject(item.dataset.subjectKey)));
}

function openSubject(key) {
  currentSubject = uniqueSubjects.find((subject) => `${subject.level}:${subject.name}` === key) || uniqueSubjects[0];
  document.querySelector("#workspaceLabel").textContent = `${currentSubject.name.toUpperCase()} · ${currentSubject.level} · ${currentSubject.progress}% COMPLETE`;
  document.querySelector("#workspaceTitle").textContent = currentSubject.name;
  document.querySelector("#workspaceDescription").textContent = currentSubject.description;
  document.querySelector("#sessionTitle").textContent = currentSubject.lesson;
  document.querySelector("#sessionSteps").innerHTML = ["Recall the key idea (10 min)", "Work through a guided example (15 min)", "Try two practice questions (15 min)", "Write a one-sentence takeaway (5 min)"].map((step) => `<li>${step}</li>`).join("");
  document.querySelector("#notes").value = localStorage.getItem(`vanes-notes-${key}`) || "";
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
document.querySelector("[data-open-subject]").addEventListener("click", () => openSubject("A-Level:Advanced Mathematics"));
document.querySelector("#mobileMenu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));

document.querySelectorAll(".filter-button").forEach((button) => button.addEventListener("click", () => {
  activeFilter = button.dataset.filter;
  document.querySelectorAll(".filter-button").forEach((item) => item.classList.toggle("active", item === button));
  renderSubjects();
}));

document.querySelector("#planForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const subject = data.get("subject"); const time = Number(data.get("time")); const goal = data.get("goal");
  const review = Math.max(5, Math.round(time * .2)); const practise = Math.max(10, Math.round(time * .45)); const reflect = Math.max(5, time - review - practise);
  const result = document.querySelector("#planResult");
  result.classList.add("generated");
  result.innerHTML = `<p class="eyebrow">${time}-MINUTE FOCUS SESSION</p><h2>${escapeHTML(subject)}</h2><p>Goal: ${escapeHTML(goal.toLowerCase())}.</p><ul><li><strong>${review} min — Warm up:</strong> recall what you already know and list one question.</li><li><strong>${practise} min — Deep work:</strong> learn one core idea and apply it to an example.</li><li><strong>${reflect} min — Lock it in:</strong> summarise the idea without looking at your notes.</li></ul><button class="primary-button" id="startPlan">Start this session →</button>`;
  document.querySelector("#startPlan").addEventListener("click", () => { const match = uniqueSubjects.find((item) => item.name.toLowerCase() === String(subject).toLowerCase()); if (match) openSubject(`${match.level}:${match.name}`); else showToast("Your custom study session is ready."); });
});

function parseTag(question) {
  const match = String(question).trim().match(/^(#\w+)\s*/i);
  return { tag: match ? match[1].toLowerCase() : "#explain", text: String(question).replace(/^(#\w+)\s*/i, "").trim() };
}

function coachSystemPrompt(tag, subjectContext = "") {
  return `You are VANES AI, an expert online study assistant for learners following the Tanzanian secondary-school curriculum. Be accurate, rigorous, encouraging, and age-appropriate. Prefer clear step-by-step reasoning, correct terminology, worked examples, and exam-oriented practice. When a claim may depend on a syllabus version, say so rather than inventing it. Never pretend you used a tool, source, or textbook you did not use.\n\nCurrent task tag: ${tag}.\n${subjectContext}\n\nTag guidance: #explain = teach clearly from first principles; #practice = create questions and give answers/marking guidance after the learner attempts them; #analyze = deeply inspect the learner's answer/question, identify errors, explain why, and show a better method; #plan = make a realistic study plan; #summarize = concise structured revision notes; #translate = translate while preserving meaning; #mark = assess an answer using a transparent rubric and give actionable corrections.`;
}

function localCoachFallback(question) {
  const { tag, text } = parseTag(question);
  if (tag === "#practice") return `I can create a proper practice set for “${text}”. Add your level/subject if you want it aligned more closely with your class, e.g. “#practice Chemistry Form 4: acids and bases”.`;
  if (tag === "#plan") return `For “${text}”, I recommend: 10 min recall, 25 min focused learning, 15 min exam-style practice, then 5 min reflection. Tell me your class, topic, and exam date for a more precise plan.`;
  return `I’m ready to help with “${text}”. Add your class and subject for a more targeted answer, for example: “#explain Form 4 Physics: electromagnetic induction”.`;
}

async function callOpenRouter(userText, imageData = null) {
  if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.includes("YOUR_OPENROUTER_API_KEY_HERE")) {
    throw new Error("OpenRouter API key is not configured. Edit OPENROUTER_API_KEY in app.js.");
  }
  const { tag, text } = parseTag(userText);
  const subjectContext = currentSubject ? `Current subject: ${currentSubject.name} (${currentSubject.level}). Current lesson: ${currentSubject.lesson}.` : "";
  const content = imageData ? [
    { type: "text", text: text || "Analyze this study image carefully. Explain what is shown, solve the question if there is one, and point out any mistakes or unclear parts." },
    { type: "image_url", image_url: { url: imageData } },
  ] : text;
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json", "HTTP-Referer": window.location.href, "X-Title": "VANES AI" },
    body: JSON.stringify({ model: OPENROUTER_MODEL, temperature: 0.25, messages: [{ role: "system", content: coachSystemPrompt(tag, subjectContext) }, { role: "user", content }] })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenRouter request failed (${response.status}).`);
  return data?.choices?.[0]?.message?.content || "The AI returned an empty response.";
}

function appendMessage(text, user = false) {
  const message = document.createElement("div");
  message.className = `message ${user ? "user-message" : "coach-message"}`;
  message.innerHTML = user ? `<p></p>` : `<span>✦</span><p></p>`;
  message.querySelector("p").textContent = text;
  document.querySelector("#messages").append(message);
  message.scrollIntoView({ behavior: "smooth", block: "end" });
}

function appendImageMessage(dataUrl) {
  const message = document.createElement("div");
  message.className = "message user-message image-message";
  message.innerHTML = `<img src="${dataUrl}" alt="Uploaded study question" />`;
  document.querySelector("#messages").append(message);
  message.scrollIntoView({ behavior: "smooth", block: "end" });
}

async function sendCoachMessage(text, imageData = null) {
  if (!text.trim() && !imageData) return;
  if (text.trim()) appendMessage(text, true);
  if (imageData) appendImageMessage(imageData);
  const thinking = document.createElement("div");
  thinking.className = "message coach-message thinking";
  thinking.innerHTML = `<span>✦</span><p>Thinking carefully…</p>`;
  document.querySelector("#messages").append(thinking);
  try {
    const reply = await callOpenRouter(text, imageData);
    thinking.remove();
    appendMessage(reply);
  } catch (error) {
    thinking.remove();
    appendMessage(`I couldn't reach the online AI. ${error.message} You can still use VANES offline, or check your OpenRouter key and internet connection.`);
  }
}

document.querySelector("#chatForm").addEventListener("submit", (event) => { event.preventDefault(); const input = document.querySelector("#chatInput"); sendCoachMessage(input.value, selectedImage); input.value = ""; selectedImage = null; });
document.querySelectorAll("[data-prompt]").forEach((button) => button.addEventListener("click", () => sendCoachMessage(button.dataset.prompt)));

document.querySelector("#uploadButton").addEventListener("click", () => document.querySelector("#imageInput").click());
document.querySelector("#imageInput").addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) { showToast("Please choose an image smaller than 8 MB."); return; }
  const reader = new FileReader();
  reader.onload = () => { selectedImage = reader.result; document.querySelector("#chatInput").value = "Analyze this image and help me understand the question."; showToast("Image attached. Press ↑ to analyze it."); };
  reader.readAsDataURL(file);
});

document.querySelector("#notes").addEventListener("input", (event) => { localStorage.setItem(`vanes-notes-${currentSubject.level}:${currentSubject.name}`, event.target.value); document.querySelector("#saveStatus").textContent = "Saved just now"; });
document.querySelector("#clearNotes").addEventListener("click", () => { document.querySelector("#notes").value = ""; localStorage.removeItem(`vanes-notes-${currentSubject.level}:${currentSubject.name}`); showToast("Notes cleared."); });
document.querySelector("#completeSession").addEventListener("click", () => { currentSubject.progress = Math.min(100, currentSubject.progress + 8); document.querySelector("#progressStat").textContent = "76%"; document.querySelector("#progressBar").style.width = "76%"; renderSubjects(); showToast("Great work — your session is complete!"); });
document.querySelector("#themeToggle").addEventListener("click", () => { document.body.classList.toggle("dark"); localStorage.setItem("vanes-theme", document.body.classList.contains("dark") ? "dark" : "light"); });

function setProfile(name) {
  const clean = name.trim();
  localStorage.setItem("vanes-user-name", clean);
  document.querySelector("#profileName").textContent = clean;
  document.querySelector("#profileAvatar").textContent = clean.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  document.querySelector("#welcomeTitle").textContent = `Make today count, ${clean}.`;
  document.querySelector("#nameModal").classList.remove("show");
  document.querySelector("#nameModal").setAttribute("aria-hidden", "true");
}

document.querySelector("#nameForm").addEventListener("submit", (event) => { event.preventDefault(); setProfile(document.querySelector("#nameInput").value); showToast("Your VANES account is ready."); });
document.querySelector("#changeName").addEventListener("click", () => { document.querySelector("#nameInput").value = localStorage.getItem("vanes-user-name") || ""; document.querySelector("#nameModal").classList.add("show"); document.querySelector("#nameModal").setAttribute("aria-hidden", "false"); });

const savedName = localStorage.getItem("vanes-user-name");
if (savedName) setProfile(savedName); else document.querySelector("#nameModal").classList.add("show");
if (localStorage.getItem("vanes-theme") === "dark") document.body.classList.add("dark");
renderSubjects();
