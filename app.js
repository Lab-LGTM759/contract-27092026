let userAddress = null;
let tronWebInstance = null;

// Адрес смарт-контракта TRC20EscrowSettlement из деплоя
const CONTRACT_ADDRESS = "TTSdHEhygmFRT6rsGrjxVizynf8ZHpLWig";

// Состояние депозита контракта
let isFundedStatus = false;

// Таймер и счетчик бесплатных кликов генерации QR-кода
const FREE_CLICKS_LIMIT = 3;

function getQrClickCount() {
    return parseInt(sessionStorage.getItem("qr_click_count") || "0", 10);
}

function incrementQrClickCount() {
    const current = getQrClickCount();
    sessionStorage.setItem("qr_click_count", (current + 1).toString());
}

// Часы Лондона (GMT/BST)
function updateLondonClock() {
    const clockElem = document.getElementById('londonClock');
    if (!clockElem) return;
    const options = { 
        timeZone: 'Europe/London', 
        hour: '2-digit', minute: '2-digit', second: '2-digit', 
        hour12: false 
    };
    clockElem.innerText = new Intl.DateTimeFormat('en-GB', options).format(new Date()) + " GMT";
}
setInterval(updateLondonClock, 1000);

// Инициализация при загрузке страницы
window.addEventListener('load', async () => {
    updateLondonClock();
    if (window.tronWeb && window.tronWeb.ready) {
        tronWebInstance = window.tronWeb;
        userAddress = tronWebInstance.defaultAddress.base58;
        document.getElementById('walletAddress').innerText = userAddress;
    }
    await refreshContractData();
    setInterval(refreshContractData, 4000);
});

// Подключение TronLink напрямую
document.getElementById('btnConnectBrowser').addEventListener('click', async () => {
    if (window.tronLink && window.tronLink.request) {
        await window.tronLink.request({ method: 'tron_requestAccounts' });
        tronWebInstance = window.tronWeb;
        userAddress = tronWebInstance.defaultAddress.base58;
        document.getElementById('walletAddress').innerText = userAddress;
        await refreshContractData();
    } else if (window.tronWeb && window.tronWeb.ready) {
        tronWebInstance = window.tronWeb;
        userAddress = tronWebInstance.defaultAddress.base58;
        document.getElementById('walletAddress').innerText = userAddress;
        await refreshContractData();
    } else {
        alert("Ошибок нет: TronLink не обнаружен. Используйте Tangem / WalletConnect для QR-сканирования.");
    }
});

// Кнопка вызова QR-кода приложения
document.getElementById('btnConnectQR').addEventListener('click', () => {
    if (!checkQrLimitsAndIncrement()) return;
    showQrModal(window.location.href, "Подключение кошелька / Wallet Connection", "Откройте dApp браузер Tangem / WalletConnect и отсканируйте код.");
});

// Считывание данных контракта
async function refreshContractData() {
    if (!tronWebInstance) return;
    try {
        const contract = await tronWebInstance.contract().at(CONTRACT_ADDRESS);

        // 1. Проверка статуса паузы
        const isPaused = await contract.isPaused().call();
        const pauseElem = document.getElementById('pauseStatusDisplay');
        pauseElem.innerText = isPaused ? "ЗАМОРОЖЕН / FROZEN" : "АКТИВЕН / ACTIVE";
        pauseElem.style.color = isPaused ? "#ef4444" : "#10b981";

        // 2. Статус депозита
        isFundedStatus = await contract.isDepositLocked().call();
        const depositText = document.getElementById('depositStatusText');
        if (isFundedStatus) {
            depositText.innerText = "Статус депозита: ВНЕСЕН И ЗАБЛОКИРОВАН / DEPOSIT LOCKED";
            depositText.style.color = "#10b981";
        } else {
            depositText.innerText = "Статус депозита: Ожидание депозита / Awaiting Deposit";
            depositText.style.color = "#f59e0b";
        }

        // 3. Оракул и расчет депозита USDT
        const reqUsdtRaw = await contract.getRequiredUsdtDeposit().call();
        const reqUsdtFormatted = (Number(reqUsdtRaw) / 1e6).toLocaleString(undefined, { minimumFractionDigits: 2 });
        document.getElementById('requiredUsdtDisplay').innerText = `${reqUsdtFormatted} USDT`;

        try {
            const oracleAddr = await contract.priceOracle().call();
            const oracleContract = await tronWebInstance.contract().at(oracleAddr);
            const rateRaw = await oracleContract.getEurUsdtRate().call();
            const rateFormatted = (Number(rateRaw) / 1e18).toFixed(4);
            document.getElementById('oracleRateDisplay').innerText = `${rateFormatted} USDT/EUR`;
        } catch (e) {
            document.getElementById('oracleRateDisplay').innerText = "1.0850 USDT/EUR (Fixed)";
        }

        // 4. Определение роли
        if (userAddress) {
            const inv = await contract.investor().call();
            const rec = await contract.receiver().call();
            const orc = await contract.oracle().call();

            const curHex = tronWebInstance.address.toHex(userAddress).toLowerCase();
            const userRoleElem = document.getElementById('userRoleDisplay');

            if (curHex === tronWebInstance.address.toHex(inv).toLowerCase()) {
                userRoleElem.innerText = "Инвестор / Investor (Party A)";
            } else if (curHex === tronWebInstance.address.toHex(rec).toLowerCase()) {
                userRoleElem.innerText = "Приемка / Receiver (Party B)";
            } else if (curHex === tronWebInstance.address.toHex(orc).toLowerCase()) {
                userRoleElem.innerText = "Оракул / Oracle Coordinator";
            } else {
                userRoleElem.innerText = "Наблюдатель / Observer";
            }
        }

        // 5. Загрузка списка получателей
        await loadPayeesTable(contract);

        // 6. Загрузка логов audit log
        await loadAuditTrail();

    } catch (err) {
        console.error("Ошибка при обновлении данных контракта:", err);
    }
}

// Загрузка таблицы получателей
async function loadPayeesTable(contract) {
    const tbody = document.getElementById('payeesTableBody');
    if (!tbody) return;

    const payeeLabels = [
        "Инвестор (Investor)", 
        "Оракул (Oracle)", 
        "Участник №0 (Participant #0)", 
        "Участник №1 (Participant #1)", 
        "Участник №2 (Participant #2)"
    ];

    let html = "";
    for (let i = 0; i < 5; i++) {
        try {
            const payee = await contract[`payee${i}`]().call();
            const walletBase58 = tronWebInstance.address.fromHex(payee.wallet);
            const sharePercent = (Number(payee.bps) / 100).toFixed(2) + "%";
            
            html += `<tr>
                <td><strong>${payeeLabels[i]}</strong></td>
                <td>${sharePercent}</td>
                <td class="hash-code">${walletBase58}</td>
                <td>-- USDT</td>
            </tr>`;
        } catch (e) {
            break;
        }
    }
    tbody.innerHTML = html;
}

// Правило 3 бесплатных кликов генерации QR-кодов
function checkQrLimitsAndIncrement() {
    if (isFundedStatus) {
        return true; // Безлимитный доступ после внесения депозита
    }

    const currentClicks = getQrClickCount();
    if (currentClicks >= FREE_CLICKS_LIMIT) {
        showQrLimitModal();
        return false;
    }

    incrementQrClickCount();
    return true;
}

// Модальное окно превышения лимита 3 кликов
function showQrLimitModal() {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = `
        <div style="padding: 10px; color: #ef4444; font-weight: bold; font-size: 13px;">
            ⚠️ Лимит исчерпан / Limit Reached
        </div>
    `;
    document.getElementById('qrModalTitle').innerText = "Предупреждение / Warning";
    document.getElementById('qrModalDescription').innerText = 
        "Бесплатный лимит 3 вызовов QR-кодов исчерпан. Пополните депозит Приемки (USDT + TRX) для разблокировки безлимитной генерации QR.\n\n" +
        "Free 3-click limit reached. Deposit USDT + TRX to unlock unlimited QR code generation.";
    
    document.getElementById('qrModal').style.display = "flex";
}

// Обобщенный генератор QR-кодов
function showQrModal(payloadUrl, title, description) {
    const qrContainer = document.getElementById('qrcode');
    qrContainer.innerHTML = "";

    new QRCode(qrContainer, {
        text: payloadUrl,
        width: 200,
        height: 200,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('qrModalTitle').innerText = title;
    document.getElementById('qrModalDescription').innerText = description;
    document.getElementById('qrModal').style.display = "flex";
}

// Закрытие модального окна
document.getElementById('btnCloseQR').addEventListener('click', () => {
    document.getElementById('qrModal').style.display = "none";
});

window.addEventListener('click', (event) => {
    const modal = document.getElementById('qrModal');
    if (event.target === modal) {
        modal.style.display = "none";
    }
});

// Кнопка подписи депозита depositAndLock()
document.getElementById('btnDepositUsdtAndGas').addEventListener('click', async () => {
    if (!checkQrLimitsAndIncrement()) return;

    // URI схема для TRON / Tangem
    const targetUri = `ethereum:${CONTRACT_ADDRESS}@728126428/depositAndLock`;
    showQrModal(
        targetUri,
        "Пополнение Депозита / Deposit TRX & USDT",
        "Отсканируйте код в кошельке Tangem для отправки транзакции depositAndLock()"
    );
});

// Кнопки генерации подписей (Stage 1 / Stage 2)
document.getElementById('btnSignInvestor').addEventListener('click', () => {
    if (!checkQrLimitsAndIncrement()) return;
    const uri = `ethereum:${CONTRACT_ADDRESS}@728126428/approveStage1Direct`;
    showQrModal(uri, "Подпись Инвестора / Investor Signature", "Отсканируйте Tangem кошельком Инвестора (approveStage1Direct)");
});

document.getElementById('btnSignOracle').addEventListener('click', () => {
    if (!checkQrLimitsAndIncrement()) return;
    const uri = `ethereum:${CONTRACT_ADDRESS}@728126428/approveStage1Direct`;
    showQrModal(uri, "Подпись Оракула / Oracle Signature", "Отсканируйте Tangem кошельком Оракула (approveStage1Direct)");
});

document.getElementById('btnSignReceiver').addEventListener('click', () => {
    if (!checkQrLimitsAndIncrement()) return;
    const uri = `ethereum:${CONTRACT_ADDRESS}@728126428/approveStage1Direct`;
    showQrModal(uri, "Подпись Приемки / Receiver Signature", "Отсканируйте Tangem кошельком Приемки (approveStage1Direct)");
});

// Исполнение Stage 2
document.getElementById('btnExecuteStage2').addEventListener('click', async () => {
    if (!checkQrLimitsAndIncrement()) return;
    const uri = `ethereum:${CONTRACT_ADDRESS}@728126428/approveStage2Direct`;
    showQrModal(uri, "Исполнение Выплат / Execute Stage 2", "Отсканируйте для подписи и выполнения выплат (approveStage2Direct)");
});

// Загрузка журнала действий из Tronscan
async function loadAuditTrail() {
    const tbody = document.getElementById("registryBody");
    if (!tbody) return;

    try {
        const response = await fetch(`https://apilist.tronscan.org/api/transaction?sort=-timestamp&limit=10&contract=${CONTRACT_ADDRESS}`);
        const data = await response.json();

        if (data && data.data && data.data.length > 0) {
            tbody.innerHTML = "";
            data.data.forEach((tx, idx) => {
                const isSuccess = tx.result === "SUCCESS" || tx.contractRet === "SUCCESS";
                const statusHtml = isSuccess
                    ? `<span style="color:#10b981; font-weight:bold;">УСПЕШНО / SUCCESS</span>`
                    : `<span style="color:#ef4444; font-weight:bold;">ОТКЛОНЕНО / FAILED</span>`;

                const timeStr = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit'
                }).format(new Date(tx.timestamp)) + " GMT";

                tbody.innerHTML += `<tr>
                    <td>${idx + 1}</td>
                    <td><strong>${tx.trigger_info?.method_name || tx.methodName || 'Вызов контракта / Call'}</strong></td>
                    <td>${timeStr}</td>
                    <td>${statusHtml}</td>
                </tr>`;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Транзакции отсутствуют / No transactions found</td></tr>';
        }
    } catch (err) {
        console.error("Ошибка сети Tronscan:", err);
    }
}
