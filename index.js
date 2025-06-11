const startBtn = document.getElementById('startBtn');
const canvas = document.getElementById('chart');
const ctx = canvas.getContext('2d');
const resultsDiv = document.getElementById('results');
const lengthInput = document.getElementById('lengthInput');
const currentAngleValue = document.getElementById('current-angle-value');

// Parametry pomiaru
let measuring = false;
let gammaData = [];
let timeData = [];
let zeroCrossings = [];
let lastGamma = null;
let lastTime = null;
let reqAnimFrame;

// NOWE flagi dla pre-delay
let measurementActive = false;

const maxDataPoints = 600;

function drawChart() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Zakładamy, że gamma jest w zakresie -10 do 10 stopni
  const angleRange = 10; // maksymalny bezwzględny kąt na osi Y

  // Oś pozioma - czas, pionowa - gamma (-10 do 10)
  ctx.strokeStyle = '#aaa';
  // rysuj oś X w 0 (środek)
  const centerY = canvas.height / 2;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(canvas.width, centerY);
  ctx.stroke();

  if (gammaData.length < 2) return;

  ctx.strokeStyle = 'blue';
  ctx.beginPath();

  // Funkcja przeliczająca wartości gamma na pozycję Y na canvasie
  const y = val => centerY - (val / angleRange) * (centerY - 10);

  for (let i = 0; i < gammaData.length; i++) {
    const x = i * canvas.width / maxDataPoints;
    if (i === 0) ctx.moveTo(x, y(gammaData[i]));
    else ctx.lineTo(x, y(gammaData[i]));
  }
  ctx.stroke();

  ctx.strokeStyle = 'red';
  zeroCrossings.forEach(cross => {
    const idx = timeData.findIndex(t => Math.abs(t - cross.time) < 10);
    if (idx !== -1) {
      const x = idx * canvas.width / maxDataPoints;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
  });

  // Opcjonalnie, można dodać subtelną ramkę pokazującą zakresy graniczne +10 i -10
  ctx.strokeStyle = '#ddd';
  ctx.beginPath();
  ctx.moveTo(0, y(angleRange));
  ctx.lineTo(canvas.width, y(angleRange));
  ctx.moveTo(0, y(-angleRange));
  ctx.lineTo(canvas.width, y(-angleRange));
  ctx.stroke();
}

function updateCurrentAngleDisplay(gamma) {
  if (currentAngleValue) {
    currentAngleValue.textContent = gamma.toFixed(2);
  }
}

function onDeviceOrientation(e) {
  updateCurrentAngleDisplay(e.gamma);

  // Nie zbieramy danych w czasie predelay
  if (!measuring || !measurementActive) return;

  const gamma = e.gamma;
  const now = Date.now();

  // Logowanie danych
  gammaData.push(gamma);
  timeData.push(now);

  if (gammaData.length > maxDataPoints) {
    gammaData.shift();
    timeData.shift();
  }


  if (
    lastGamma !== null &&
    Math.sign(lastGamma) !== Math.sign(gamma)
  ) {
    const lastCross = zeroCrossings[zeroCrossings.length - 1];
    if (!lastCross || now - lastCross.time >= 300) {
      zeroCrossings.push({ time: now });
      if (zeroCrossings.length >= 20) {
        stopMeasuring();
        return;
      }
    }
  }

  if (
    zeroCrossings.length > 0 &&
    now - zeroCrossings[zeroCrossings.length - 1].time > 10000
  ) {
    stopMeasuring();
    return;
  }

  lastGamma = gamma;
  lastTime = now;

  drawChart();
  reqAnimFrame = requestAnimationFrame(() => {});
}

function startMeasuring() {
  measuring = true;
  measurementActive = false; // na razie nie mierzymy, czekamy 2 sekundy
  gammaData = [];
  timeData = [];
  zeroCrossings = [];
  lastGamma = null;
  lastTime = null;
  resultsDiv.textContent = '';
  drawChart();

  window.addEventListener('deviceorientation', onDeviceOrientation, true);

  // Aktywuj właściwy pomiar dopiero po 2 sekundach
  setTimeout(() => {
    measurementActive = true;
  }, 2000);
}

function stopMeasuring() {
  measuring = false;
  measurementActive = false;
  window.removeEventListener('deviceorientation', onDeviceOrientation, true);
  cancelAnimationFrame(reqAnimFrame);

  if (zeroCrossings.length < 2) {
    resultsDiv.textContent = 'Za mało przejść przez zero.';
    return;
  }

  const periods = [];
  for (let i = 2; i < zeroCrossings.length; i += 2) {
    const t1 = zeroCrossings[i - 2].time;
    const t2 = zeroCrossings[i].time;
    periods.push((t2 - t1) / 1000);
  }
  const avgPeriod = periods.reduce((a, b) => a + b, 0) / periods.length;

  const length = parseFloat(lengthInput.value);
  if (isNaN(length) || length <= 0) {
    resultsDiv.textContent = 'Podano niepoprawną długość linki.';
    return;
  }

  const g = 4 * Math.PI * Math.PI * length / (avgPeriod * avgPeriod);

  resultsDiv.innerHTML = `
    Liczba przejść przez zero: ${zeroCrossings.length}<br>
    Średni okres (s): ${avgPeriod.toFixed(3)}<br>
    Przyspieszenie ziemskie (g) = <b>${g.toFixed(3)} m/s²</b>
  `;

}

startBtn.addEventListener('click', () => {
  startBtn.disabled = true;
  startMeasuring();
  setTimeout(() => {
    startBtn.disabled = false;
    stopMeasuring();
  }, 30000);
});

updateCurrentAngleDisplay(0);
drawChart();