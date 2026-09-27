// НАСТРОЙКИ КОНТРАКТОВ (TRON Shasta / Mainnet)
const ESCROW_CONTRACT_ADDRESS = "TTSdHEhygmFRT6rsGrjxVizynf8ZHpLWig";
const USDT_CONTRACT_ADDRESS   = "TYjJUFsd9h5Vr93ANveHwv6mXnJ1dDCmui";

const REQUIRED_TRX_SUN = "2000000000"; // 2000 TRX в SUN
const TOKEN_DECIMALS = 6;

// ЯЗЫКОВЫЕ СЛОВАРИ (RU / EN)
const i18n = {
  ru: {
    connectTronLink: "TronLink",
    connectTangem: "Tangem / WalletConnect",
    londonTimeLabel: "Текущее время (Лондон / GMT):",
    contractDeployedText: "Контракт успешно выпущен и активен в сети TRON:",
    walletAddress: "Адрес кошелька",
    userRole: "Ваша роль",
    contractStatus: "Статус контракта",
    statusWaitingDeposit: "Ожидание депозита",
    statusLocked: "Этап 1: Депозит Внесен",
    statusStage1Done: "Этап 1 Завершен (3/3 Подписи)",
    statusExecuted: "Этап 2 Исполнен (Выплаты завершены)",
    oracleMonitoringTitle: "Мониторинг курса EUR/USDT и Депозита (Real-time)",
    totalVolume: "Объем сделки",
    oracleRate: "Курс Оракула EUR/USDT",
    requiredUsdt: "Требуемый депозит USDT (11.55%)",
    requiredTrx: "Требуемый TRX (Газ)",
    bufferStatusTitle: "Динамический буфер (Вернется Приемке в конце):",
    stepDepositTitle: "Депозит Приемки (Receiver)",
    stepDepositDesc: "Приемка одобряет лимит USDT и переводит 11.55% в USDT + 2000 TRX на контракт.",
    btnApprove: "1. Approve USDT",
    btnDeposit: "2. Deposit & Lock (USDT + 2000 TRX)",
    stage1Title: "Этап 1: Фиксация и Подписи Сторон",
    timerTitle: "Таймер 5 рабочих дней (Лондонское время):",
    timerNote: "* Суббота и воскресенье автоматически исключены из отсчета.",
    btnSign: "Подписать сообщение",
    stage2Title: "Этап 2: Расчет и Автоматические Выплаты",
    stage2Desc: "Приемка активирует исполнение с 3 подписями. Средства распределяются агентам, а остаток возвращается Приемке.",
    btnExecuteStage2: "Execute Stage 2 Payouts",
    logTitle: "Журнал действий (Audit Log)",
    logWho: "Кто",
    logTime: "Время (Лондон / GMT)",
    logResult: "Результат / Действие"
  },
  en: {
    connectTronLink: "TronLink",
    connectTangem: "Tangem / WalletConnect",
    londonTimeLabel: "Current Time (London / GMT):",
    contractDeployedText: "Contract successfully deployed and active on TRON:",
    walletAddress: "Wallet Address",
    userRole: "Your Role",
    contractStatus: "Contract Status",
    statusWaitingDeposit: "Awaiting Deposit",
    statusLocked: "Stage 1: Deposit Locked",
    statusStage1Done: "Stage 1 Completed (3/3 Signatures)",
    statusExecuted: "Stage 2 Executed (Payouts Completed)",
    oracleMonitoringTitle: "Real-time EUR/USDT Rate & Deposit Monitoring",
    totalVolume: "Total Contract Volume",
    oracleRate: "Oracle Rate EUR/USDT",
    requiredUsdt: "Required USDT Deposit (11.55%)",
    requiredTrx: "Required TRX (Gas)",
    bufferStatusTitle: "Dynamic Buffer (Will be refunded to Receiver):",
    stepDepositTitle: "Receiver Deposit",
    stepDepositDesc: "Receiver approves USDT allowance and transfers 11.55% USDT + 2000 TRX into escrow.",
    btnApprove: "1. Approve USDT",
    btnDeposit: "2. Deposit & Lock (USDT + 2000 TRX)",
    stage1Title: "Stage 1: Signatures & Verification",
    timerTitle: "5 Working Days Timer (London Time):",
    timerNote: "* Saturdays and Sundays are excluded automatically.",
    btnSign: "Generate Signature",
    stage2Title: "Stage 2: Settlement & Automatic Payouts",
    stage2Desc: "Receiver activates payouts with 3 signatures. Funds are distributed to agents, excess refunded to Receiver.",
    btnExecuteStage2: "Execute Stage 2 Payouts",
    logTitle: "Audit Log",
    logWho: "Who",
    logTime: "London Time (GMT)",
    logResult: "Action / Result"
  }
};

let currentLang = "ru";
let userAddress = null;
let escrowContract = null;
let usdtContract = null;
let logCounter = 1;

let signatures = { investor: null, oracle: null, receiver: null };
let stage1StartTime = null;

// ПОЛУЧАТЕЛИ КОМИССИЙ (ИЗ СМАРТ-КОНТРАКТА)
const PAYEES = [
  { name: "Инвестор (Investor)", bps: 500, address: "0x1111111111111111111111111111111111111111" },
  { name: "Оракул (Oracle)", bps: 175, address: "0x3333333333333333333333333333333333333333" },
  { name: "Участник №0 (Participant 0)", bps: 175, address: "0x4444444444444444444444444444444444444444" },
  { name: "Участник №1 (Participant 1)", bps: 150, address: "0x5555555555555555555555555555555555555555" },
  { name: "Участник №2 (Participant 2)", bps: 100, address: "0x6666666666666666666666666666666666666666" }
];

// ВПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ВРЕМЕНИ (ЛОНДОН / GMT)
function getLondonTimeString() {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Europe/London" }) + " GMT";
}

function getLondonDateTimeString() {
  const d = new Date();
  const dateStr = d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
  const timeStr = d.toLocaleTimeString("en-GB", { timeZone: "Europe/London" });
  return `${dateStr} ${timeStr} GMT`;
}

function updateLondonClock() {
  document.getElementById("londonClock").textContent = getLondonTimeString();
}
setInterval(updateLondonClock, 1000);

// ДОБАВЛЕНИЕ ЗАПИСИ В АУДИТ-ЖУРНАЛ
function addAuditLog(who, result) {
  const tbody = document.getElementById("auditLogBody");
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><strong>#${logCounter++}</strong></td>
    <td>${who}</td>
    <td>${getLondonDateTimeString()}</td>
    <td>${result}</td>
  `;
  tbody.prepend(tr);
}

// ИНИЦИАЛИЗАЦИЯ И ПОДКЛЮЧЕНИЕ КОШЕЛЬКА
async function init() {
  renderPayeesTable();
  updateLondonClock();
  
  document.getElementById("langToggleBtn").addEventListener("click", toggleLanguage);
  document.getElementById("connectTronLinkBtn").addEventListener("click", connectTronLink);
  document.getElementById("connectWCBtn").addEventListener("click", connectWalletConnect);

  document.getElementById("actionUsdtBtn").addEventListener("click", handleApproveUsdt);
  document.getElementById("depositBtn").addEventListener("click", handleDepositAndLock);
  
  document.getElementById("signInvestorBtn").addEventListener("click", () => generateSignature('investor'));
  document.getElementById("signOracleBtn").addEventListener("click", () => generateSignature('oracle'));
  document.getElementById("signReceiverBtn").addEventListener("click", () => generateSignature('receiver'));

  document.getElementById("executeStage2Btn").addEventListener("click", handleExecuteStage2);

  // Авто-подключение при наличии TronLink
  if (window.tronWeb && window.tronWeb.ready) {
    await connectTronLink();
  }

  // Мониторинг оракула каждые 5 секунд
  setInterval(pollOracleAndBuffer, 5000);
}

async function connectTronLink() {
  if (!window.tronWeb) {
    alert("TronLink не найден!");
    return;
  }
  try {
    userAddress = window.tronWeb.defaultAddress.base58;
    document.getElementById("accountAddress").textContent = `${userAddress.substring(0,6)}...${userAddress.substring(userAddress.length-4)}`;
    
    escrowContract = await window.tronWeb.contract().at(ESCROW_CONTRACT_ADDRESS);
    usdtContract = await window.tronWeb.contract().at(USDT_CONTRACT_ADDRESS);

    addAuditLog(userAddress, "Успешное подключение через TronLink");
    await updateState();
  } catch (e) {
    addAuditLog("Система", `Ошибка TronLink: ${e.message}`);
  }
}

// Гибридная поддержка Tangem через WalletConnect v2
async function connectWalletConnect() {
  try {
    const provider = new WalletConnectProvider.default({
      rpc: { 728126428: "https://api.shasta.trongrid.io" },
      qrcodeModalOptions: { desktopLinks: [] }
    });

    await provider.enable();
    const web3Accounts = provider.accounts;
    userAddress = web3Accounts[0];
    document.getElementById("accountAddress").textContent = `Tangem: ${userAddress.substring(0,6)}...`;

    addAuditLog(userAddress, "Подключен кошелек Tangem via WalletConnect v2");
    await updateState();
  } catch (e) {
    addAuditLog("Система", `Ошибка WalletConnect: ${e.message}`);
  }
}

// ОБНОВЛЕНИЕ СОСТОЯНИЯ И РЕАЛ-ТАЙМ МОНИТОРИНГ
async function pollOracleAndBuffer() {
  if (!escrowContract) return;

  try {
    const rawRate = await escrowContract.fixedEurUsdtRate().call();
    const currentRate = rawRate > 0 ? rawRate : "1080000000000000000"; // Пример 1.08 EUR/USDT если ставка не зафиксирована
    
    const rateFormatted = (Number(currentRate) / 1e18).toFixed(4);
    document.getElementById("oracleRateDisplay").textContent = `1 EUR = ${rateFormatted} USDT`;

    const rawRequired = await escrowContract.getRequiredUsdtDeposit().call();
    const formattedUsdt = (Number(rawRequired) / 1e6).toLocaleString();
    document.getElementById("requiredUsdtDisplay").textContent = `${formattedUsdt} USDT`;

    // Расчет текущего буфера (+ / - к возврату Приемке)
    const baseFee = Number(formattedUsdt.replace(/,/g, '')) * (11.00 / 11.55);
    const bufferUsdt = Number(formattedUsdt.replace(/,/g, '')) - baseFee;
    
    document.getElementById("bufferDeltaDisplay").textContent = 
      `+${bufferUsdt.toLocaleString(undefined, {maximumFractionDigits: 2})} USDT (Буфер будет перерасчитан и вернут на адрес Приемки)`;

  } catch (e) {
    console.error("Ошибка опроса оракула:", e);
  }
}

async function updateState() {
  if (!escrowContract) return;

  await pollOracleAndBuffer();

  const isLocked = await escrowContract.isDepositLocked().call();
  const isStage1Done = await escrowContract.isStage1Completed().call();
  const isStage2Done = await escrowContract.isStage2Activated().call();

  // Обновление кнопок
  document.getElementById("actionUsdtBtn").disabled = isLocked;
  document.getElementById("depositBtn").disabled = isLocked;

  document.getElementById("signInvestorBtn").disabled = !isLocked || isStage1Done;
  document.getElementById("signOracleBtn").disabled = !isLocked || isStage1Done;
  document.getElementById("signReceiverBtn").disabled = !isLocked || isStage1Done;

  document.getElementById("executeStage2Btn").disabled = !(signatures.investor && signatures.oracle && signatures.receiver) || isStage2Done;

  if (isLocked && !stage1StartTime) {
    stage1StartTime = new Date();
    startBankTimer();
  }
}

// ДВУХЭТАПНОЕ ПОПОЛНЕНИЕ (APPROVE + DEPOSIT)
async function handleApproveUsdt() {
  try {
    const rawRequired = await escrowContract.getRequiredUsdtDeposit().call();
    addAuditLog(userAddress, "Запрос на Approve USDT для Escrow...");
    
    const tx = await usdtContract.approve(ESCROW_CONTRACT_ADDRESS, rawRequired).send();
    addAuditLog(userAddress, `Approve выполнен успешно! TX: ${tx}`);
  } catch (e) {
    addAuditLog(userAddress, `Ошибка Approve: ${e.message}`);
  }
}

async function handleDepositAndLock() {
  try {
    addAuditLog(userAddress, "Внесение депозита (USDT + 2000 TRX на газ)...");
    const tx = await escrowContract.depositAndLock().send({ callValue: REQUIRED_TRX_SUN });
    
    addAuditLog(userAddress, `Депозит успешно внесен и заблокирован! TX: ${tx}`);
    await updateState();
  } catch (e) {
    addAuditLog(userAddress, `Ошибка депозита: ${e.message}`);
  }
}

// ГЕНЕРАЦИЯ ПОДПИСЕЙ (OFF-CHAIN ECDSA / TANGEM)
async function generateSignature(role) {
  try {
    const message = `Confirm Escrow Stage 1 Approval for contract ${ESCROW_CONTRACT_ADDRESS}`;
    addAuditLog(userAddress, `Запрос подписи (${role})...`);

    let sig = await window.tronWeb.trx.sign(window.tronWeb.toHex(message));
    signatures[role] = sig;

    const badge = document.getElementById(`sigStatus${role.charAt(0).toUpperCase() + role.slice(1)}`);
    badge.textContent = "Подписано ✅";
    badge.className = "badge badge-success";

    addAuditLog(userAddress, `Подпись ${role} успешно сгенерирована.`);
    await updateState();
  } catch (e) {
    addAuditLog(userAddress, `Ошибка генерации подписи: ${e.message}`);
  }
}

// ИСПОЛНЕНИЕ ВЫПЛАТ ЭТАПА 2
async function handleExecuteStage2() {
  try {
    addAuditLog(userAddress, "Запуск финализации и выплат Этапа 2...");
    const tx = await escrowContract.approveStage2Direct().send();

    addAuditLog(userAddress, `Выплаты успешно выполнены! TX: ${tx}`);
    document.getElementById("escrowStatus").textContent = i18n[currentLang].statusExecuted;
    document.getElementById("escrowStatus").className = "badge badge-success";

    await updatePayeesBalances();
  } catch (e) {
    addAuditLog(userAddress, `Ошибка исполнения выплат: ${e.message}`);
  }
}

// ТАЙМЕР 5 РАБОЧИХ (БАНКОВСКИХ) ДНЕЙ (ЛОНДОН)
function startBankTimer() {
  setInterval(() => {
    if (!stage1StartTime) return;

    const now = new Date();
    let secondsAdded = 0;
    let targetWorkingSeconds = 5 * 24 * 3600; // 5 рабочих дней

    let current = new Date(stage1StartTime);
    while (secondsAdded < targetWorkingSeconds) {
      current.setSeconds(current.getSeconds() + 1);
      const day = current.getUTCDay(); // 0 = Воскресенье, 6 = Суббота
      if (day !== 0 && day !== 6) {
        secondsAdded++;
      }
    }

    const diff = Math.max(0, Math.floor((current - now) / 1000));
    const days = Math.floor(diff / (24 * 3600));
    const hours = Math.floor((diff % (24 * 3600)) / 3600);
    const mins = Math.floor((diff % 3600) / 60);
    const secs = diff % 60;

    document.getElementById("bankTimer").textContent = 
      `${days}д ${hours.toString().padStart(2, '0')}ч ${mins.toString().padStart(2, '0')}м ${secs.toString().padStart(2, '0')}с`;
  }, 1000);
}

// ТАБЛИЦА УЧАСТНИКОВ И БАЛАНСОВ
function renderPayeesTable() {
  const tbody = document.getElementById("payeesTableBody");
  tbody.innerHTML = "";

  PAYEES.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td>${(p.bps / 100).toFixed(2)}%</td>
      <td><code>${p.address}</code></td>
      <td id="balance-${p.address}">0.00 USDT</td>
    `;
    tbody.appendChild(tr);
  });
}

async function updatePayeesBalances() {
  for (let p of PAYEES) {
    try {
      if (usdtContract) {
        const bal = await usdtContract.balanceOf(p.address).call();
        document.getElementById(`balance-${p.address}`).textContent = `${(Number(bal) / 1e6).toLocaleString()} USDT`;
      }
    } catch (e) {
      console.error(e);
    }
  }
}

// ПЕРЕКЛЮЧЕНИЕ ЯЗЫКА (RU / EN)
function toggleLanguage() {
  currentLang = currentLang === "ru" ? "en" : "ru";
  document.getElementById("langToggleBtn").textContent = currentLang === "ru" ? "English" : "Русский";

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (i18n[currentLang][key]) {
      el.textContent = i18n[currentLang][key];
    }
  });
}

window.addEventListener("load", init);
