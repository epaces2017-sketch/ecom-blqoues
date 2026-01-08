// Parámetros del examen
const PASS_PERCENT = 70;
let QUESTIONS_PER_BLOCK = 35; 
let currentMode = "block"; // "block" o "simulacro"
const SIMULACRO_SPECIALTIES = [
  "Neumología",
  "Cirugía",
  "Gastroenterología",
  "Ginecología - Obstetricia",
  "Hematología",
  "Urología",
  "Endocrinología",
  "Dermatología",
  "Infectología",
  "Reumatología",
  "Vascular",
  "Traumatología",
  "Otorrinolaringología",
  "Geriatría",
  "Psiquiatría",
  "Neurología",
  "Pediatría",
  "Cardiología",
  "Medicina Familiar",
  "Investigacion y Etica Medica",
  "Nefrología"
];

// Estado global
let allQuestions = [];
let examQuestions = [];
let currentIndex = 0;
let answers = {};          // { questionId: "A"|"B"|... }
let examStartTime = null;
let timerInterval = null;
let currentMode = "block"; // "block" o "simulacro" - Inicializar aquí para evitar problemas de scope

// Referencias DOM - Usar querySelector para evitar errores si los elementos no existen
const screenStart   = document.querySelector("#screen-start");
const screenExam    = document.querySelector("#screen-exam");
const screenResults = document.querySelector("#screen-results");
const modeSelect    = document.querySelector("#mode-select");

const btnStart   = document.querySelector("#btn-start");
const btnPrev    = document.querySelector("#btn-prev");
const btnNext    = document.querySelector("#btn-next");
const btnRestart = document.querySelector("#btn-restart");

const systemSelect   = document.querySelector("#system-select");
const numQuestionsEl = document.querySelector("#num-questions");
const startError     = document.querySelector("#start-error");

const questionCounter      = document.querySelector("#question-counter");
const questionSystem       = document.querySelector("#question-system");
const questionStem         = document.querySelector("#question-stem");
const questionImageWrapper = document.querySelector("#question-image-wrapper");
const optionsContainer     = document.querySelector("#options-container");

const globalTimerEl        = document.querySelector("#global-timer");

const scoreMain            = document.querySelector("#score-main");
const scoreStatus          = document.querySelector("#score-status");
const scoreMeta            = document.querySelector("#score-meta");
const resultsTableWrapper  = document.querySelector("#results-table-wrapper");

/* ------------------ Utilidades ------------------ */
function shuffle(array) {
  // Implementación Fisher-Yates shuffle (más eficiente)
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildSimulacroQuestions() {
  const PER_SPECIALTY = 7;
  let selected = [];

  // Validación más robusta
  if (!Array.isArray(SIMULACRO_SPECIALTIES) || SIMULACRO_SPECIALTIES.length === 0) {
    console.error("SIMULACRO_SPECIALTIES no está definido o está vacío.");
    return [];
  }

  SIMULACRO_SPECIALTIES.forEach(spec => {
    const pool = allQuestions.filter(q => (q.system || "").trim() === spec);

    if (pool.length === 0) {
      console.warn(`⚠️ No hay preguntas para: ${spec}`);
      return;
    }

    const numToSelect = Math.min(PER_SPECIALTY, pool.length); // Seleccionar como máximo PER_SPECIALTY o el tamaño del pool si es menor
    const slice = shuffle(pool).slice(0, numToSelect);
    selected = selected.concat(slice);
  });

  return shuffle(selected);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2,"0")}:${String(seconds).padStart(2,"0")}`;
}

// ------------------ Lógica de inicio del examen ------------------
function startExam() {
  // Usar operador de encadenamiento opcional para evitar errores si los elementos son null
  const mode = modeSelect?.value || "block";
  const system = systemSelect?.value || "";
  const n = parseInt(numQuestionsEl?.value || "0", 10);

  if (isNaN(n) || n <= 0) {
    startError.textContent = "Número de preguntas inválido.";
    return;
  }

  currentMode = mode;

  if (mode === "block") {
    const pool = allQuestions.filter(q => q.system === system);

    if (pool.length === 0) {
      startError.textContent = "No hay preguntas para ese sistema.";
      return;
    }

    const shuffled = shuffle(pool);
    examQuestions = shuffled.slice(0, Math.min(n, shuffled.length));

  } else if (mode === "simulacro") {
    examQuestions = buildSimulacroQuestions();

    if (n && examQuestions.length > n) {
      examQuestions = examQuestions.slice(0, n);
    }
    numQuestionsEl.value = examQuestions.length; // Actualizar el valor del input
  } else {
    startError.textContent = "Modo desconocido.";
    return;
  }

  if (!examQuestions || examQuestions.length === 0) {
    startError.textContent = "No se pudieron armar preguntas para este modo.";
    return;
  }

  currentIndex = 0;
  answers = {};
  examStartTime = Date.now();

  showScreen("exam");
  startTimer(currentMode); // Pasar el modo al timer
  renderQuestion();
}

// ------------------ Cargar banco de preguntas ------------------
async function loadQuestions() {
  try {
    console.log("Intentando cargar questions.json...");
    const res = await fetch("./questions.json", {
      cache: "no-store"
    });

    console.log("Respuesta HTTP de questions.json:", res.status, res.statusText);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`); // Usar template literals para mejor legibilidad
    }

    const data = await res.json();

    console.log("Preguntas cargadas:", Array.isArray(data) ? data.length : "no es array");
    allQuestions = Array.isArray(data) ? data : [];

    if (allQuestions.length === 0) {
      console.warn("Ojo: questions.json se cargó pero viene vacío.");
    }
  } catch (err) {
    console.error("Error cargando questions.json", err);
    startError.textContent = "No se pudo cargar el banco de preguntas.";
    allQuestions = [];
  }
}

// ------------------ Reloj global ------------------
function startTimer(mode) {
  examStartTime = Date.now();
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(() => {
    const elapsedSec = Math.floor((Date.now() - examStartTime) / 1000);
    globalTimerEl.textContent = formatTime(elapsedSec);

    // ⏰ Límite de 5 horas SOLO en simulacro
    const LIMIT_SECONDS = 5 * 60 * 60; // 5h
    if (mode === "simulacro" && elapsedSec >= LIMIT_SECONDS) {
      clearInterval(timerInterval);
      timerInterval = null;
      finishExam(true); // true = se acabó el tiempo
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// ------------------ Pantallas ------------------
function showScreen(name) {
  // Usar operador de encadenamiento opcional para evitar errores si los elementos son null
  screenStart?.classList.add("hidden");
  screenExam?.classList.add("hidden");
  screenResults?.classList.add("hidden");

  if (name === "start")   screenStart?.classList.remove("hidden");
  if (name === "exam")    screenExam?.classList.remove("hidden");
  if (name === "results") screenResults?.classList.remove("hidden");
}

// ------------------ Mostrar pregunta actual ------------------
function renderQuestion() {
  console.log(
    "renderQuestion called. currentIndex:",
    currentIndex,
    "examQuestions length:",
    examQuestions.length
  );

  const q = examQuestions[currentIndex];
  console.log("Current question object:", q);

  if (!q) {
    console.error("No question found at index", currentIndex);
    return;
  }

  // Encabezado
  questionCounter.textContent = `Pregunta ${currentIndex + 1} de ${examQuestions.length}`;
  questionSystem.textContent  = `Sistema: ${q.system}`;
  questionStem.textContent    = `(${q.id}) ${q.question}`;

  // Imagen
  questionImageWrapper.innerHTML = "";
  if (q.image && typeof q.image === "string" && q.image.trim() !== "") {
    const img = document.createElement("img");
    img.src = q.image;
    img.alt = "Imagen de la pregunta";
    img.className = "question-image";
    img.onerror = () => {
      console.warn("Imagen no encontrada:", q.image);
      img.remove();
    };
    questionImageWrapper.appendChild(img);
  }

  // Opciones
  optionsContainer.innerHTML = "";
  const letters = ["A", "B", "C", "D"];

  letters.forEach(letter => {
    const text = q.options[letter];
    if (!text || text.trim() === "") return;

    const row = document.createElement("div");
    row.className = "option-row";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "option";
    input.value = letter;
    input.className = "option-input";
    input.id = `option-${q.id}-${letter}`; // ID único para accesibilidad

    const saved = answers[q.id];
    if (saved === letter) {
      input.checked = true;
    }

    input.addEventListener("change", () => {
      answers[q.id] = letter;
    });

    const letterSpan = document.createElement("span");
    letterSpan.className = "option-letter";
    letterSpan.textContent = letter;

    const textSpan = document.createElement("span");
    textSpan.className = "option-text";
    textSpan.textContent = text;

    const label = document.createElement("label"); // Usar label para accesibilidad
    label.htmlFor = `option-${q.id}-${letter}`;
    label.appendChild(input);
    label.appendChild(letterSpan);
    label.appendChild(textSpan);

    row.appendChild(label); // Agregar el label a la fila

    optionsContainer.appendChild(row);
  });

  // Botones Prev / Next
  btnPrev.disabled = currentIndex === 0;
  btnNext.textContent =
    currentIndex === examQuestions.length - 1
      ? "Finalizar"
      : "Siguiente";

  console.log("Question rendered successfully.");
}

// ------------------ Finalizar examen ------------------
function finishExam(timeUp = false) {
  stopTimer();

  const totalQuestions = examQuestions.length;
  let correctCount = 0;

  examQuestions.forEach(q => {
    if (answers[q.id] === q.correct) correctCount++;
  });

  const percentGlobal = Math.round((correctCount / totalQuestions) * 100);

  // Estadísticas por sistema
  const statsBySystem = {};
  examQuestions.forEach(q => {
    const sys = q.system || "Sin sistema";
    if (!statsBySystem[sys]) statsBySystem[sys] = { total: 0, correct: 0 };
    statsBySystem[sys].total++;
    if (answers[q.id] === q.correct) statsBySystem[sys].correct++;
  });

  const systems = Object.keys(statsBySystem);

  let passed;
  let statusText;
  let metaExtra;

  if (currentMode === "block") {
    // criterio global por porcentaje
    passed = percentGlobal >= PASS_PERCENT;
    statusText = passed ? "APROBADO BLOQUE" : "NO APROBADO BLOQUE";

    const totalSystems = systems.length;
    let systemsPassed = 0;
    systems.forEach(sys => {
      const s = statsBySystem[sys];
      const localPercent = (s.correct / s.total) * 100;
      if (localPercent >= 70) systemsPassed++;
    });
    const neededSystems = Math.ceil(0.7 * totalSystems);

    metaExtra =
      `Sistemas aprobados: <strong>${systemsPassed} / ${totalSystems}</strong> (mínimo ${neededSystems}). ` +
      `Criterio por sistema: <strong>≥ 70%</strong>.`;
  } else if (currentMode === "simulacro") {
    // criterio por subárea: mínimo 4/7 correctas
    let systemsPassed = 0;
    systems.forEach(sys => {
      const s = statsBySystem[sys];
      if (s.correct >= 4) systemsPassed++;
    });
    const neededSystems = Math.ceil(0.5 * systems.length);

    passed = systemsPassed >= neededSystems;
    statusText = passed ? "APROBADO SIMULACRO" : "NO APROBADO SIMULACRO";

    metaExtra =
      `Subáreas aprobadas: <strong>${systemsPassed} / ${systems.length}</strong> (mínimo ${neededSystems}). ` +
      `Criterio por subárea: <strong>≥ 4/7 (50%)</strong>.`;
  }

  const totalSeconds = Math.floor((Date.now() - examStartTime) / 1000);
  const avgSeconds   = totalSeconds / totalQuestions;

  scoreMain.textContent   = `${percentGlobal}% (${correctCount} / ${totalQuestions})`;
  scoreStatus.textContent = statusText;
  scoreStatus.className   = passed ? "score-status-pass" : "score-status-fail";

  let timeMsg = `Tiempo total: <strong>${formatTime(totalSeconds)}</strong>`;
  if (timeUp && currentMode === "simulacro") {
    timeMsg += " (⏰ Se alcanzó el límite de 5 h)";
  }

  scoreMeta.innerHTML = `
    <div>${timeMsg}</div>
    <div>Tiempo promedio por pregunta: <strong>${avgSeconds.toFixed(1)} s</strong></div>
    <div>${metaExtra}</div>
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
    const userAns  = answers[q.id] || "-";
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

// ------------------ Eventos ------------------
btnStart?.addEventListener("click", startExam); // Usar optional chaining

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
  answers       = {};
  examQuestions = [];
  currentIndex  = 0;
  showScreen("start");
});

// ------------------ Arranque ------------------
loadQuestions();
showScreen("start");
