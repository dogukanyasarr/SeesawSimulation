const plank = document.getElementById("plank");
const pivot = document.getElementById("pivot");
const container = document.getElementById("seesawContainer");

const nextWeightEl = document.getElementById("nextWeight");
const leftWeightEl = document.getElementById("leftWeight");
const rightWeightEl = document.getElementById("rightWeight");
const totalWeightEl = document.getElementById("totalWeight");
const angleDisplayEl = document.getElementById("angleDisplay");
const resetButton = document.getElementById("resetButton");
const pauseButton = document.getElementById("pauseButton");
const logList = document.getElementById("logList");

let objects = JSON.parse(localStorage.getItem("seesawObjects")) || [];
let nextWeight = Math.floor(Math.random() * 10) + 1;
let isPaused = false;

let nextObjectId = 0;
let currentAngle = 0;
let angularVelocity = 0;

const G = 9.81;
const MAX_ANGLE_DEG = 30;
const DAMPING = 0.005;
const MAX_ANGLE_RAD = MAX_ANGLE_DEG * (Math.PI / 180);
const BOARD_MASS_I_FACTOR = 10000;
const DROP_DURATION = 0.7;

let lastTime = 0;

function randColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 80%, 55%)`;
}

function getPivotLocal() {
  const contRect = container.getBoundingClientRect();
  const pivotRect = pivot.getBoundingClientRect();
  const px = pivotRect.left - contRect.left + pivotRect.width / 2;
  const py = pivotRect.top - contRect.top + pivotRect.height / 2;
  return { px, py };
}

function axisAndNormal(angleRad) {
  const a = angleRad;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const nx = Math.sin(a);
  const ny = -Math.cos(a);
  return { ux, uy, nx, ny, a };
}

function computeTargetCenter(distanceFromPivot, radius, angleRad, dropFactor = 0) {
  const { px, py } = getPivotLocal();
  const { ux, uy, nx, ny } = axisAndNormal(angleRad);
  const plankThickness = parseFloat(getComputedStyle(plank).height) || 12;
  const offset = plankThickness / 2 + radius + 2;

  let cx = px + distanceFromPivot * ux + nx * offset;
  let cy = py + distanceFromPivot * uy + ny * offset;

  if (dropFactor > 0) {
    const dropHeight = 200;
    cx += nx * dropHeight * dropFactor;
    cy += ny * dropHeight * dropFactor;
  }

  return { cx, cy };
}
function renderObjects() {
  document.querySelectorAll(".weight-object").forEach((n) => n.remove());

  objects.forEach((obj) => {
    const el = createObjectDOM(obj);
    container.appendChild(el);
  });

  updateObjectPositions(true);
}
// ağırlık toplarını fonksiyon olarak oluşturuyprum.
function createObjectDOM(obj) {
  const el = document.createElement("div");
  el.className = "weight-object";
  el.textContent = obj.weight;
  el.dataset.x = obj.x;
  el.style.background = obj.color;

  const size = 20 + obj.weight * 2;
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.lineHeight = `${size}px`;
  el.style.borderRadius = "50%";
  el.style.position = "absolute";
  el.style.transform = "translate(-50%,-50%)";
  el.style.pointerEvents = "none";
  el.style.color = "#fff";
  el.style.fontWeight = "bold";
  el.style.textShadow = "0 0 3px rgba(0,0,0,0.6)";


  el.dataset.objId = obj.id;
  return el;
}

function updateObjectPositions(instant = false) {
  const angleDeg = currentAngle * (180 / Math.PI);
  plank.style.transform = `translateX(-50%) rotate(${angleDeg}deg)`;

  document.querySelectorAll(".weight-object").forEach((el) => {
    const objId = parseInt(el.dataset.objId);
    const obj = objects.find(o => o.id === objId);
    if (!obj) return;

    const dist = parseFloat(el.dataset.x);
    const size = parseFloat(el.style.width) || 28;
    const r = size / 2;

    const isDropping = obj.isDropping || false;
    const dropFactor = obj.dropProgress || 0;

    const { cx, cy } = computeTargetCenter(dist, r, currentAngle, dropFactor);

    if (instant || !isDropping) {
      el.style.transition = "left 0.05s linear, top 0.05s linear";
    } else {
      el.style.transition = "none";
    }

    el.style.left = `${cx}px`;
    el.style.top = `${cy}px`;
  });
}

// tork hesabım
function calculateTorque(objects) {
  let leftTorque = 0;
  let rightTorque = 0;
  let totalLeftWeight = 0;
  let totalRightWeight = 0;

  objects.forEach((obj) => {
    const d = obj.x;
    const force = obj.weight * G;
    if (d < 0) {
      leftTorque += Math.abs(d) * force;
      totalLeftWeight += obj.weight;
    }
    else {
      rightTorque += d * force;
      totalRightWeight += obj.weight;
    }
  });

  leftWeightEl.textContent = totalLeftWeight.toFixed(1);
  rightWeightEl.textContent = totalRightWeight.toFixed(1);
  totalWeightEl.textContent = (totalLeftWeight + totalRightWeight).toFixed(1);

  return rightTorque - leftTorque;
}

function calculateMomentOfInertia(objects) {
  let I = 0;
  objects.forEach((obj) => {
    I += obj.weight * Math.pow(obj.x, 2);
  });
  return I + BOARD_MASS_I_FACTOR;
}

function gameLoop(time) {
  if (!isPaused) {
    const deltaTime = (time - lastTime) / 1000;

    const netTork = calculateTorque(objects);
    const I = calculateMomentOfInertia(objects);
    const angularAcceleration = netTork / I;

    angularVelocity += angularAcceleration * deltaTime;
    angularVelocity *= (1 - DAMPING);

    currentAngle += angularVelocity * deltaTime;
    currentAngle = Math.max(-MAX_ANGLE_RAD, Math.min(MAX_ANGLE_RAD, currentAngle));

    updateDropAnimations(deltaTime);
    updateObjectPositions(false);

    angleDisplayEl.textContent = `${(currentAngle * (180 / Math.PI)).toFixed(1)}°`;

  }

  lastTime = time;
  requestAnimationFrame(gameLoop);
}
function updateDropAnimations(deltaTime) {
  objects.forEach(obj => {
    if (obj.isDropping) {
      obj.dropTimer = (obj.dropTimer || 0) + deltaTime;

      let progress = 1 - Math.min(1, obj.dropTimer / DROP_DURATION);

      obj.dropProgress = Math.pow(progress, 2);

      if (obj.dropProgress === 0) {
        obj.isDropping = false;
        delete obj.dropTimer;
        delete obj.dropProgress;
        localStorage.setItem("seesawObjects", JSON.stringify(objects));
      }
    }
  });
}
function addWeightHandler(e) {
  if (isPaused) return;
  const plankRect = plank.getBoundingClientRect();
  const clickX = e.clientX - (plankRect.left + plankRect.width / 2);

  const color = randColor();
  const currentAddedWeight = nextWeight;

  const newObj = {
    id: nextObjectId++,
    x: clickX,
    weight: currentAddedWeight,
    color,
    isDropping: true,
    dropProgress: 1.0,
  };

  objects.push(newObj);
  localStorage.setItem("seesawObjects", JSON.stringify(objects));

  nextWeight = Math.floor(Math.random() * 10) + 1;
  nextWeightEl.textContent = `${nextWeight} kg`;
  addLog(newObj);

  const el = createObjectDOM(newObj);
  container.appendChild(el);

  updateObjectPositions(true); 
}
function deleteWeight(id, listItemEl) {
  objects = objects.filter(o => o.id !== id);

  localStorage.setItem("seesawObjects", JSON.stringify(objects));
  const el = document.querySelector(`.weight-object[data-obj-id="${id}"]`);
  if (el) el.remove();

  if (listItemEl) listItemEl.remove();

  calculateTorque(objects);
}

function addLog(obj) {
  const li = document.createElement("li");
  li.className = "log-item"; 

  const side = obj.x >= 0 ? "SAĞ" : "SOL";
  const pos = Math.abs(obj.x.toFixed(0));

  const textSpan = document.createElement("span");
  textSpan.className = "log-text";
  textSpan.textContent = `Ağırlık: ${obj.weight} kg | Konum: ${side} tarafa konumlandırıldı. (${pos}) px`;

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.textContent = "Sil";

  deleteBtn.addEventListener("click", () => {
    deleteWeight(obj.id, li);
  });

  li.appendChild(textSpan);
  li.appendChild(deleteBtn);
  logList.prepend(li);
}


function resetAll() {
  objects = [];
  localStorage.removeItem("seesawObjects");
  document.querySelectorAll(".weight-object").forEach((n) => n.remove());
  
  currentAngle = 0;
  angularVelocity = 0; 
  
  plank.style.transform = `translateX(-50%) rotate(0deg)`;
  angleDisplayEl.textContent = `0°`;
  leftWeightEl.textContent = "0";
  rightWeightEl.textContent = "0";
  totalWeightEl.textContent = "0";
  logList.innerHTML = "";
}

function togglePause() {
  isPaused = !isPaused;
  pauseButton.textContent = isPaused ? "Devam Et" : "Durdur";
}

plank.addEventListener("click", addWeightHandler);
resetButton.addEventListener("click", resetAll);
pauseButton.addEventListener("click", togglePause);

nextWeightEl.textContent = `${nextWeight} kg`;

nextObjectId = objects.length > 0 ? Math.max(...objects.map(o => o.id || 0)) + 1 : 0;
renderObjects();

requestAnimationFrame(gameLoop);
