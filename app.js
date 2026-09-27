// --- Константы адресов ---
const ESCROW_ADDRESS = "TTSdHEhygmFRT6rsGrjxVizynf8ZHpLWig";
const USDT_ADDRESS = "TYjJUFsd9h5Vr93ANveHwv6mXnJ1dDCmui";

let currentAccount = null;
let escrowContract = null;
let usdtContract = null;
let logCounter = 1;

// --- Часы (Лондонское время / GMT) ---
function updateLondonClock() {
  const clockEl = document.getElementById('londonClock');
  if (!clockEl) return;
  const now = new Date();
  const options = { timeZone: 'Europe/London', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' };
  clockEl.innerText = new Intl.DateTimeFormat('en-GB', options).format(now) + ' GMT';
}
setInterval(updateLondonClock, 1000);
updateLondonClock();

// --- Журнал действий (Audit Log) ---
function addAuditLog(who, action) {
  const tbody = document.getElementById('auditLogBody');
  if (!tbody) return;
  const row = document.createElement('tr');
  const now = new Date();
  const timeStr = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  
  row.innerHTML = `
    <td>${logCounter++}</td>
    <td><code>${who}</code></td>
    <td>${timeStr} GMT</td>
    <td>${action}</td>
  `;
  tbody.prepend(row);
}

// --- Подключение кошелька TronLink ---
async function connectTronLink() {
  if (window.tronWeb && window.tronWeb.ready) {
    currentAccount = window.tronWeb.defaultAddress.base58;
    const accEl = document.getElementById('accountAddress');
    if (accEl) {
      accEl.innerText = currentAccount.substring(0, 6) + '...' + currentAccount.substring(currentAccount.length - 4);
    }
    
    addAuditLog(currentAccount, "Кошелек TronLink успешно подключен");
    
    await initContracts();
    await refreshState();
  } else {
    alert("Пожалуйста, установите или разблокируйте расширение TronLink!");
  }
}

// --- Инициализация контрактов ---
async function initContracts() {
  try {
    escrowContract = await window.tronWeb.contract().at(ESCROW_ADDRESS);
    usdtContract = await window.tronWeb.contract().at(USDT_ADDRESS);
  } catch (err) {
    console.error("Ошибка инициализации контрактов:", err);
  }
}

// --- Чтение данных и обновление статуса ---
async function refreshState() {
  if (!escrowContract) return;

  try {
    // 1. Чтение статуса блокировки депозита
    const rawLocked = await escrowContract.isDepositLocked().call();
    const isLockedStr = String(rawLocked?._hex || rawLocked?.toString() || rawLocked);
    const isLocked = isLockedStr === 'true' || isLockedStr === '1' || rawLocked === true;

    const statusBadge = document.getElementById('escrowStatus');

    if (statusBadge) {
      if (isLocked) {
        statusBadge.className = 'badge badge-success';
        statusBadge.innerText = 'Депозит внесен / Заблокирован';
        
        // Включаем кнопки подписи на Этапе 1
        const btnInv = document.getElementById('signInvestorBtn');
        const btnOrc = document.getElementById('signOracleBtn');
        const btnRec = document.getElementById('signReceiverBtn');
        
        if (btnInv) btnInv.disabled = false;
        if (btnOrc) btnOrc.disabled = false;
        if (btnRec) btnRec.disabled = false;
      } else {
        statusBadge.className = 'badge badge-warning';
        statusBadge.innerText = 'Ожидание депозита';
      }
    }

    // 2. Чтение требуемого USDT
    const reqUsdtRaw = await escrowContract.getRequiredUsdtDeposit().call();
    const reqUsdtVal = window.tronWeb.BigNumber(reqUsdtRaw._hex || reqUsdtRaw).toNumber();
    const reqUsdtFormatted = (reqUsdtVal / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 });
    
    const reqUsdtEl = document.getElementById('requiredUsdtDisplay');
    if (reqUsdtEl) reqUsdtEl.innerText = reqUsdtFormatted + ' USDT';

    // 3. Чтение курса Оракула (исправление нулевого курса)
    const rateRaw = await escrowContract.fixedEurUsdtRate().call();
    const rateVal = window.tronWeb.BigNumber(rateRaw._hex || rateRaw).toNumber();
    const rateFormatted = (rateVal / 1e6).toFixed(4);
    
    const rateEl = document.getElementById('oracleRateDisplay');
    if (rateEl) rateEl.innerText = `1 EUR = ${rateFormatted} USDT`;

    const bufferEl = document.getElementById('bufferDeltaDisplay');
    if (bufferEl) bufferEl.innerText = "0 USDT (Буфер отсутствует / Корректно)";

  } catch (err) {
    console.error("Ошибка при обновлении состояния:", err);
  }
}

// --- Обработчик 1: Approve USDT ---
async function handleApprove() {
  if (!usdtContract || !escrowContract) return alert("Сначала подключите кошелек!");
  try {
    const requiredUsdt = await escrowContract.getRequiredUsdtDeposit().call();
    addAuditLog(currentAccount, "Отправка запроса Approve USDT...");
    
    const tx = await usdtContract.approve(ESCROW_ADDRESS, requiredUsdt.toString()).send();
    addAuditLog(currentAccount, `Approve выполнен успешно! TX: ${tx}`);
    alert("Approve успешно подтвержден!");
  } catch (err) {
    const msg = err?.message || err || "Транзакция отклонена пользователем";
    addAuditLog(currentAccount, `Ошибка Approve: ${msg}`);
    alert("Ошибка Approve: " + msg);
  }
}

// --- Обработчик 2: Deposit & Lock ---
async function handleDeposit() {
  if (!escrowContract) return alert("Сначала подключите кошелек!");
  try {
    addAuditLog(currentAccount, "Отправка 2000 TRX + USDT на Deposit & Lock...");
    
    const tx = await escrowContract.depositAndLock().send({
      callValue: window.tronWeb.toSun(2000),
      feeLimit: 150000000
    });
    
    addAuditLog(currentAccount, `Депозит заблокирован в контракте! TX: ${tx}`);
    alert("Депозит успешно зафиксирован!");
    
    // Пауза 3 сек для майнинга блока перед обновлением
    setTimeout(refreshState, 3000);
  } catch (err) {
    const msg = err?.message || err || "Транзакция отклонена пользователем";
    addAuditLog(currentAccount, `Ошибка депозита: ${msg}`);
    alert("Ошибка депозита: " + msg);
  }
}

// --- Генерация подписей сторон ---
function handleSign(role) {
  const badgeMap = {
    'Investor': 'sigStatusInvestor',
    'Oracle': 'sigStatusOracle',
    'Receiver': 'sigStatusReceiver'
  };
  
  const badge = document.getElementById(badgeMap[role]);
  if (badge) {
    badge.className = 'badge badge-success';
    badge.innerText = 'Подписано ✅';
    addAuditLog(currentAccount || role, `Сгенерирована подпись роли: ${role}`);
  }
}

// --- Инициализация событий ---
document.addEventListener('DOMContentLoaded', () => {
  const btnConnectTL = document.getElementById('connectTronLinkBtn');
  const btnApprove = document.getElementById('actionUsdtBtn');
  const btnDeposit = document.getElementById('depositBtn');

  if (btnConnectTL) btnConnectTL.addEventListener('click', connectTronLink);
  if (btnApprove) btnApprove.addEventListener('click', handleApprove);
  if (btnDeposit) btnDeposit.addEventListener('click', handleDeposit);

  const btnInv = document.getElementById('signInvestorBtn');
  const btnOrc = document.getElementById('signOracleBtn');
  const btnRec = document.getElementById('signReceiverBtn');

  if (btnInv) btnInv.addEventListener('click', () => handleSign('Investor'));
  if (btnOrc) btnOrc.addEventListener('click', () => handleSign('Oracle'));
  if (btnRec) btnRec.addEventListener('click', () => handleSign('Receiver'));

  // Периодическое автоматическое обновление статусов каждые 5 секунд
  setInterval(() => {
    if (window.tronWeb && window.tronWeb.ready && escrowContract) {
      refreshState();
    }
  }, 5000);

  // Автоподключение при старте
  setTimeout(() => {
    if (window.tronWeb && window.tronWeb.ready) {
      connectTronLink();
    }
  }, 1000);
});
