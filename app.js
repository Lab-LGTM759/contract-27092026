/**
 * Tangem Gasless Escrow dApp Client
 * Поддерживает гибридное подключение: TronLink, Web3 и WalletConnect v2 (Tangem NFC App)
 */

const CONFIG = {
    contractAddress: "0x7777777777777777777777777777777777777777", // Адрес смарт-контракта
    usdtAddress: "0xa614f803B6FD780986A42c78Ec9c7f77e6DeD13C",     // Адрес TRC-20 / ERC-20 USDT
    trxRequiredSun: "2000000000",                                 // 2000 TRX на газ
    walletConnectProjectId: "YOUR_WALLETCONNECT_PROJECT_ID"       // Ваш ID с cloud.walletconnect.com
};

const ESCROW_ABI = [
    "function getRequiredUsdtDeposit() public view returns (uint256)",
    "function depositAndLock() external payable",
    "function isDepositLocked() public view returns (bool)",
    "function isStage1Completed() public view returns (bool)",
    "function priceOracle() public view returns (address)"
];

const ORACLE_ABI = [
    "function getEurUsdtRate() external view returns (uint256)"
];

const ERC20_ABI = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)"
];

let userAddress = null;
let provider = null;
let signer = null;
let escrowContract = null;
let usdtContract = null;
let requiredUsdtAmount = "0";

window.addEventListener("load", async () => {
    log("Инициализация dApp...");
    document.getElementById("btnConnect").addEventListener("click", connectWallet);
    document.getElementById("btnApprove").addEventListener("click", handleApprove);
    document.getElementById("btnDeposit").addEventListener("click", handleDepositAndLock);
});

function log(message, type = "system") {
    const consoleEl = document.getElementById("logConsole");
    if (!consoleEl) return;
    const p = document.createElement("p");
    p.className = `log-entry ${type}`;
    p.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    consoleEl.appendChild(p);
    consoleEl.scrollTop = consoleEl.scrollHeight;
}

async function connectWallet() {
    try {
        // 1. Проверка встроенного браузера кошелька (TronLink или Web3)
        if (window.ethereum || window.tronWeb) {
            log("Подключение через встроенный Web3 / TronLink провайдер...");
            provider = new ethers.providers.Web3Provider(window.ethereum || window.tronWeb);
            await provider.send("eth_requestAccounts", []);
            signer = provider.getSigner();
            userAddress = await signer.getAddress();
        } 
        // 2. Подключение Tangem через WalletConnect v2
        else if (window.WalletConnectProvider) {
            log("Запуск WalletConnect для Tangem (Откройте QR-код)...");
            const wcProvider = new WalletConnectProvider.default({
                projectId: CONFIG.walletConnectProjectId,
                rpc: { 728126428: "https://api.trongrid.io" }
            });
            await wcProvider.enable();
            provider = new ethers.providers.Web3Provider(wcProvider);
            signer = provider.getSigner();
            userAddress = await signer.getAddress();
        } else {
            alert("Кошелек не обнаружен. Установите TronLink или сканируйте QR-код через мобильное приложение Tangem.");
            return;
        }

        document.getElementById("accountAddress").textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(userAddress.length - 4)}`;
        document.getElementById("networkStatus").className = "status-dot online";
        log(`Кошелек успешно подключен: ${userAddress}`, "success");

        initContracts();
        await updateDashboardData();
    } catch (err) {
        log(`Ошибка подключения: ${err.message || err}`, "error");
    }
}

function initContracts() {
    escrowContract = new ethers.Contract(CONFIG.contractAddress, ESCROW_ABI, signer);
    usdtContract = new ethers.Contract(CONFIG.usdtAddress, ERC20_ABI, signer);
}

async function updateDashboardData() {
    try {
        log("Запрос точных данных из смарт-контракта...");

        // 1. Запрос динамически рассчитанного депозита USDT
        const rawRequiredUsdt = await escrowContract.getRequiredUsdtDeposit();
        requiredUsdtAmount = rawRequiredUsdt.toString();

        // Форматирование (6 decimals для USDT)
        const formattedUsdt = ethers.utils.formatUnits(rawRequiredUsdt, 6);
        document.getElementById("requiredUsdt").textContent = `${Number(formattedUsdt).toLocaleString()} USDT`;

        // 2. Получение текущего курса из Оракула
        const oracleAddress = await escrowContract.priceOracle();
        const oracleContract = new ethers.Contract(oracleAddress, ORACLE_ABI, provider);
        const rate = await oracleContract.getEurUsdtRate();
        const formattedRate = ethers.utils.formatUnits(rate, 18);
        document.getElementById("oracleRate").textContent = `1 EUR = ${Number(formattedRate).toFixed(4)} USDT`;

        // 3. Проверка статусов контракта
        const isLocked = await escrowContract.isDepositLocked();
        const isStage1 = await escrowContract.isStage1Completed();

        if (isLocked) {
            const depositEl = document.getElementById("depositStatus");
            depositEl.textContent = "Внесен и заблокирован";
            depositEl.className = "status-badge active";
            document.getElementById("btnDeposit").disabled = true;
            document.getElementById("btnApprove").disabled = true;
        } else {
            await checkAllowance();
        }

        if (isStage1) {
            const stage1El = document.getElementById("stage1Status");
            stage1El.textContent = "Пройден";
            stage1El.className = "status-badge active";
        }

        log("Данные dApp обновлены.", "success");
    } catch (err) {
        log(`Ошибка загрузки данных: ${err.message || err}`, "error");
    }
}

async function checkAllowance() {
    const currentAllowance = await usdtContract.allowance(userAddress, CONFIG.contractAddress);
    if (currentAllowance.gte(requiredUsdtAmount)) {
        document.getElementById("btnApprove").disabled = true;
        document.getElementById("btnDeposit").disabled = false;
        log("Лимит USDT одобрен. Готово к пополнению.");
    } else {
        document.getElementById("btnApprove").disabled = false;
        document.getElementById("btnDeposit").disabled = true;
        log("Требуется подтверждение Approve в кошельке Tangem.");
    }
}

async function handleApprove() {
    try {
        log("Подтвердите транзакцию Approve на карте Tangem...");
        const tx = await usdtContract.approve(CONFIG.contractAddress, requiredUsdtAmount);
        log(`Транзакция отправлена: ${tx.hash}`);
        await tx.wait();
        log("Одобрение USDT успешно подтверждено!", "success");
        await checkAllowance();
    } catch (err) {
        log(`Ошибка при одобрении USDT: ${err.message || err}`, "error");
    }
}

async function handleDepositAndLock() {
    try {
        log("Подтвердите пополнение (USDT + 2000 TRX) на карте Tangem...");
        const tx = await escrowContract.depositAndLock({
            value: CONFIG.trxRequiredSun // 2000 TRX в SUN
        });
        log(`Транзакция пополнения отправлена: ${tx.hash}`);
        await tx.wait();
        log("Депозит заблокирован в смарт-контракте!", "success");
        await updateDashboardData();
    } catch (err) {
        log(`Ошибка при внесении депозита: ${err.message || err}`, "error");
    }
}
