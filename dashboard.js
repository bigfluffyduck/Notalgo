// ================= FIREBASE IMPORTS =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc, 
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
// ================= FIREBASE CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyDkuk7_JrB2QN0R3ir0HVNyecqlA54tS1U",
  authDomain: "notalgo.firebaseapp.com",
  projectId: "notalgo",
  appId: "1:240974177203:web:08b783d7dcb08b651ee1c6"
};

// ================= INIT =================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ================= DOM =================
const greeting = document.getElementById("greeting");
const timeline = document.getElementById("timeline");
const countText = document.getElementById("countText");

const modal = document.getElementById("logModal");
const openBtn = document.getElementById("openLogModal");
const closeBtn = document.getElementById("closeModal");

const platformInput = document.getElementById("platform");
const linkInput = document.getElementById("problemLink");
const ratingInput = document.getElementById("rating");
const difficultyInput = document.getElementById("difficulty");
const statusInput = document.getElementById("status");
const insightInput = document.getElementById("insight");
const tagsInput = document.getElementById("tags");
const saveBtn = document.getElementById("saveProblem");

// ================= STATE =================
let currentUser = null;
let editingProblemId = null;

// ================= AUTH + USERNAME =================
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  currentUser = user;

  const snap = await getDoc(doc(db, "users", user.uid));
  if (!snap.exists()) {
    window.location.href = "username.html";
    return;
  }

  greeting.textContent = `Hi, ${snap.data().username} 👋`;
  loadProblems();
});

// ================= MODAL =================
openBtn.onclick = () => {
  editingProblemId = null;
  clearForm();
  modal.classList.add("active");
};

closeBtn.onclick = closeModal;

modal.onclick = (e) => {
  if (e.target === modal) closeModal();
};

function closeModal() {
  modal.classList.remove("active");
  editingProblemId = null;
}
// ================= ESC KEY TO CLOSE MODAL =================
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modal.classList.contains("active")) {
    closeModal();
    clearForm();
  }
});
// ================= HELPERS =================
function detectPlatform(url) {
  if (url.includes("codeforces.com")) return "Codeforces";
  if (url.includes("leetcode.com")) return "LeetCode";
  return "Unknown";
}

function difficultyFromRating(rating) {
  if (rating < 1000) return "Easy";
  if (rating < 1600) return "Medium";
  return "Hard";
}
ratingInput.addEventListener("input", () => {
  const rating = Number(ratingInput.value);

  if (!rating || rating <= 0) {
    difficultyInput.value = "";
    return;
  }

  difficultyInput.value = difficultyFromRating(rating);
});

// ================= AUTOFILL =================
linkInput.addEventListener("blur", async () => {
  const link = linkInput.value.trim();
  if (!link) return;

  const platform = detectPlatform(link);
  platformInput.value = platform;

  ratingInput.value = "";
  difficultyInput.value = "";
  tagsInput.value = "";

  if (platform === "Codeforces") {
    await autofillCodeforces(link);
  }
});

// ================= CODEFORCES AUTOFILL =================
async function autofillCodeforces(link) {
  try {
    const match = link.match(/problemset\/problem\/(\d+)\/([A-Z0-9]+)/);
    if (!match) return;

    const contestId = match[1];
    const index = match[2];

    const res = await fetch("https://codeforces.com/api/problemset.problems");
    const data = await res.json();

    const problem = data.result.problems.find(
      p => p.contestId == contestId && p.index == index
    );

    if (!problem) return;

    if (problem.rating) {
      ratingInput.value = problem.rating;
      difficultyInput.value = difficultyFromRating(problem.rating);
    }

    if (problem.tags?.length) {
      tagsInput.value = problem.tags.join(", ");
    }

    platformInput.value = "Codeforces";
    statusInput.value = "Understood";

  } catch (err) {
    console.error("Codeforces autofill failed:", err);
  }
}

// ================= SAVE (CREATE OR UPDATE) =================
saveBtn.onclick = async () => {
  const tags = tagsInput.value
    .split(",")
    .map(t => t.trim())
    .filter(Boolean);

  const payload = {
    platform: platformInput.value,
    problemLink: linkInput.value,
    rating: Number(ratingInput.value) || null,
    difficulty: difficultyInput.value,
    status: statusInput.value,
    insight: insightInput.value,
    tags,
    updatedAt: new Date()
  };

  if (editingProblemId) {
    await updateDoc(
      doc(db, "users", currentUser.uid, "problems", editingProblemId),
      payload
    );
  } else {
    await addDoc(
      collection(db, "users", currentUser.uid, "problems"),
      { ...payload, createdAt: new Date() }
    );
  }

  closeModal();
  clearForm();
  loadProblems();
};
const deleteBtn = document.getElementById("deleteProblem");

deleteBtn.onclick = async () => {
  if (!editingProblemId) return;

  const confirmed = confirm(
    "Are you sure you want to delete this problem? This cannot be undone."
  );

  if (!confirmed) return;

  await deleteDoc(
    doc(db, "users", currentUser.uid, "problems", editingProblemId)
  );

  closeModal();
  clearForm();
  loadProblems();
};

// ================= LOAD PROBLEMS =================
async function loadProblems() {
  timeline.innerHTML = "<h2>Learning timeline</h2>";

  const q = query(
    collection(db, "users", currentUser.uid, "problems"),
    orderBy("createdAt", "desc")
  );

  const snapshot = await getDocs(q);
  countText.textContent =
    `You’ve logged insights from ${snapshot.size} problems`;

  snapshot.forEach(docSnap => {
    timeline.innerHTML += createCard(docSnap.data(), docSnap.id);
  });
}

// ================= CARD =================
function createCard(data, id) {
  return `
    <div class="card" data-id="${id}">

      <div class="card-top">
        <div class="left">
          <span class="platform">
            ${data.platform === "Codeforces"
              ? `<img src="https://codeforces.org/s/0/favicon-96x96.png" class="platform-icon" />`
              : ""}
            ${data.platform}
          </span>

          <span class="difficulty ${data.difficulty.toLowerCase()}">
            ${data.difficulty}
          </span>
        </div>

        <span class="status ${data.status.toLowerCase()}">
          ${data.status}
        </span>
      </div>

      <div class="insight">
        <span class="label">Insight:</span>
        <span class="text">${data.insight}</span>
      </div>

      <div class="card-footer">
        <div class="tags">
          ${data.tags.map(t => `<span>${t}</span>`).join("")}
        </div>

        ${data.problemLink ? `
          <a href="${data.problemLink}" target="_blank" class="problem-link">
            View problem →
          </a>` : ""}
      </div>

    </div>
  `;
}

// ================= CLICK CARD → EDIT =================
timeline.addEventListener("click", async (e) => {
  const card = e.target.closest(".card");
  if (!card) return;

  editingProblemId = card.dataset.id;

  const snap = await getDoc(
    doc(db, "users", currentUser.uid, "problems", editingProblemId)
  );
  if (!snap.exists()) return;

  const data = snap.data();

  platformInput.value = data.platform;
  linkInput.value = data.problemLink || "";
  ratingInput.value = data.rating || "";
  difficultyInput.value = data.difficulty;
  statusInput.value = data.status;
  insightInput.value = data.insight;
  tagsInput.value = data.tags.join(", ");

  modal.classList.add("active");
});

// ================= RESET FORM =================
function clearForm() {
  platformInput.value = "";
  linkInput.value = "";
  ratingInput.value = "";
  difficultyInput.value = "";
  statusInput.value = "";
  insightInput.value = "";
  tagsInput.value = "";
}
// ================= LOGOUT =================
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      await signOut(auth);
      window.location.href = "login.html";
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Check console.");
    }
  });
} else {
  console.error("logoutBtn not found");
}
