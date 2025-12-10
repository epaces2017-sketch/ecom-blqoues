// Parámetros del examen
const PASS_PERCENT = 70;
let QUESTIONS_PER_BLOCK = 35;
let currentMode = "block"; // "block" o "simulacro"

// Estado global
let allQuestions = [];
let examQuestions = [];
let currentIndex = 0;
let answers = {};          // { questionId: "A"|"B"|... }
let examStartTime = null;
let timerInterval = null;

// Referencias DOM
const screenStart   = document.getElementById("screen-start");
const screenExam    = document.getElementById("screen-exam");
const screenResults = document.getElementById("screen-results");
const modeSelect    = document.getElementById("mode-select");

const btnStart   = document.getElementById("btn-start");
const btnPrev    = document.getElementById("btn-prev");
const btnNext    = document.getElementById("btn-next");
const btnRestart = document.getElementById("btn-restart");

const systemSelect   = document.getElementById("system-select");
const numQuestionsEl = document.getElementById("num-questions");
const startError     = document.getElementById("start-error");

const questionCounter = document.getElementById("question-counter");
const questionSystem  = document.getElementById("question-system");
const questionStem    = document.getElementById("question-stem");
const questionImageWrapper = document.getElementById("question-image-wrapper");
const optionsContainer = document.getElementById("options-container");

const globalTimerEl = document.getElementById("global-timer");

const scoreMain   = document.getElementById("score-main");
const scoreStatus = document.getElementById("score-status");
const scoreMeta   = document.getElementById("score-meta");
const resultsTableWrapper = document.getElementById("results-table-wrapper");

// Utilidades
function shuffle(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

// Cargar banco de preguntas
async function loadQuestions() {
  try {
    const res = await fetch("questions.json");
    allQuestions = await res.json();
  } catch (err) {
    console.error("Error cargando questions.json", err);
    startError.textContent = "No se pudo cargar el banco de preguntas.";
  }
}

// Iniciar reloj global
function startTimer() {
  examStartTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - examStartTime) / 1000);
    globalTimerEl.textContent = formatTime(elapsedSec);
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Navegación de pantallas
function showScreen(name) {
  screenStart.classList.add("hidden");
  screenExam.classList.add("hidden");
  screenResults.classList.add("hidden");

  if (name === "start")   screenStart.classList.remove("hidden");
  if (name === "exam")    screenExam.classList.remove("hidden");
  if (name === "results") screenResults.classList.remove("hidden");
}

// Mostrar pregunta actual
function renderQuestion() {
  const q = examQuestions[currentIndex];
  if (!q) return;

  questionCounter.textContent = `Pregunta ${currentIndex + 1} de ${examQuestions.length}`;
  questionSystem.textContent = `Sistema: ${q.system}`;

  questionStem.textContent = `(${q.id}) ${q.question}`;
  questionImageWrapper.innerHTML = "";

  if (q.image) {
    const img = document.createElement("img");
    img.src = q.image;
    img.alt = "Imagen de la pregunta";
    img.className = "question-image";
    questionImageWrapper.appendChild(img);
  }

  optionsContainer.innerHTML = "";
  const letters = ["A","B","C","D"];

  letters.forEach(letter => {
    const text = q.options[letter];
    if (!text) return;

    const row = document.createElement("div");
    row.className = "option-row";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "option";
    input.value = letter;
    input.className = "option-input";

    const saved = answers[q.id];
    if (saved === letter) {
      input.checked = true;
    }

    const letterSpan = document.createElement("span");
    letterSpan.className = "option-letter";
    letterSpan.textContent = letter;

    const textSpan = document.createElement("span");
    textSpan.className = "option-text";
    textSpan.textContent = text;

    row.appendChild(input);
    row.appendChild(letterSpan);
    row.appendChild(textSpan);

    // Permitir click en todo el row
    row.addEventListener("click", (e) => {
      input.checked = true;
      answers[q.id] = letter;
    });

    optionsContainer.appendChild(row);
  });

  // Prev/Next habilitados
  btnPrev.disabled = currentIndex === 0;
  btnNext.textContent = (currentIndex === examQuestions.length - 1)
    ? "Finalizar bloque"
    : "Siguiente";
}

// Calcular resultados y mostrar pantalla tipo NBME
function finishExam() {
  stopTimer();

  const totalQuestions = examQuestions.length;
  let correctCount = 0;

  examQuestions.forEach(q => {
    if (answers[q.id] === q.correct) correctCount++;
  });

  const percent = Math.round((correctCount / totalQuestions) * 100);
  const passed = percent >= PASS_PERCENT;

  const totalSeconds = Math.floor((Date.now() - examStartTime) / 1000);
  const avgSeconds = totalSeconds / totalQuestions;

  scoreMain.textContent = `${percent}% (${correctCount} / ${totalQuestions})`;
  scoreStatus.textContent = passed ? "APROBADO" : "NO APROBADO";
  scoreStatus.className = passed ? "score-status-pass" : "score-status-fail";

  scoreMeta.innerHTML = `
    <div>Tiempo total: <strong>${formatTime(totalSeconds)}</strong></div>
    <div>Tiempo promedio por pregunta: <strong>${avgSeconds.toFixed(1)} s</strong></div>
  `;

  // Tabla de detalle
  let html = `
    <h3>Detalle por pregunta</h3>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Sistema</th>
          <th>ID</th>
          <th>Pregunta</th>
          <th>Tu respuesta</th>
          <th>Correcta</th>
          <th>Estado</th>
          <th>Explicación</th>
        </tr>
      </thead>
      <tbody>
  `;

  examQuestions.forEach((q, idx) => {
    const userAns = answers[q.id] || "-";
    const isCorrect = userAns === q.correct;

    html += `
      <tr>
        <td>${idx + 1}</td>
        <td>${q.system}</td>
        <td>${q.id}</td>
        <td>${q.question}</td>
        <td>${userAns}</td>
        <td>${q.correct}</td>
        <td>
          <span class="pill ${isCorrect ? "pill-pass" : "pill-fail"}">
            ${isCorrect ? "Correcta" : "Incorrecta"}
          </span>
        </td>
        <td>${q.explanation || ""}</td>
      </tr>
    `;
  });

  html += "</tbody></table>";
  resultsTableWrapper.innerHTML = html;

  showScreen("results");
}

// Eventos
btnStart.addEventListener("click", () => {
  startError.textContent = "";

  if (!allQuestions || allQuestions.length === 0) {
    startError.textContent = "Aún no se ha cargado el banco de preguntas.";
    return;
  }

  const system = systemSelect.value;
  const n = parseInt(numQuestionsEl.value, 10);
  if (isNaN(n) || n <= 0) {
    startError.textContent = "Número de preguntas inválido.";
    return;
  }
  QUESTIONS_PER_BLOCK = n;

  // Filtrar por sistema
  let pool = allQuestions;
  if (system !== "ALL") {
    pool = allQuestions.filter(q => q.system === system);
  }

  if (pool.length === 0) {
    startError.textContent = "No hay preguntas para ese sistema.";
    return;
  }

  const shuffled = shuffle(pool);
  examQuestions = shuffled.slice(0, Math.min(QUESTIONS_PER_BLOCK, shuffled.length));
  currentIndex = 0;
  answers = {};

  showScreen("exam");
  startTimer();
  renderQuestion();
});

btnPrev.addEventListener("click", () => {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
});

btnNext.addEventListener("click", () => {
  if (currentIndex === examQuestions.length - 1) {
    finishExam();
  } else {
    currentIndex++;
    renderQuestion();
  }
});

btnRestart.addEventListener("click", () => {
  stopTimer();
  globalTimerEl.textContent = "00:00";
  answers = {};
  examQuestions = [];
  currentIndex = 0;
  showScreen("start");
});

// Arranque
loadQuestions();
showScreen("start");
