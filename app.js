// Адрес задеплоенного контракта в сети TRON Shasta (EVM Hex формат для ethers.js)
const CONTRACT_ADDRESS = "0x708afe235a9b4e7616dbdb0e74c7d239b1a130f2";

const CONTRACT_ABI = [
  "function investor() view returns (address)",
  "function receiver() view returns (address)",
  "function oracle() view returns (address)",
  "function chainId() view returns (uint256)",
  "function nonce() view returns (uint256)",
  "function isDepositLocked() view returns (bool)",
  "function isStage1Completed() view returns (bool)",
  "function isStage2Activated() view returns (bool)",
  "function isPaused() view returns (bool)",
  "function fixedEurUsdtRate() view returns (uint256)",
  "function REQUIRED_USDT_DEPOSIT() view returns (uint256)",
  "function REQUIRED_TRX_GAS() view returns (uint256)",
  "function depositAndLock(uint256 usdtAmount) payable",
  "function signStage1(bytes32 investorPassport, bytes32 receiverPassport, bytes32 oracleCode, uint256 timeA, uint256 timeB, uint256 timeOracle, bytes sigA, bytes sigB, bytes sigOracle)",
  "function executeStage2AndDistribute(uint256 timeA, uint256 timeB, uint256 timeOracle, bytes sigA, bytes sigB, bytes sigOracle)",
  "function withdrawAfterLockTimeout()",
  "function emergencyRefundAfterTimeout()"
];

let provider;
let signer;
let contract;
let userAddress;

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
  document.getElementById("depositBtn").addEventListener("click", depositAndLock);
  document.getElementById("signStage1MsgBtn").addEventListener("click", signStage1Local);
  document.getElementById("execStage1Btn").addEventListener("click", executeStage1);
  document.getElementById("signStage2MsgBtn").addEventListener("click", signStage2Local);
  document.getElementById("execStage2Btn").addEventListener("click", executeStage2);
  document.getElementById("withdrawLockTimeoutBtn").addEventListener("click", withdrawAfterLockTimeout);
  document.getElementById("emergencyRefundBtn").addEventListener("click", emergencyRefund);
});

async function connectWallet() {
  if (!window.ethereum) return alert("Пожалуйста, установите MetaMask или TronLink Web3 Провайдер!");

  try {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = provider.getSigner();
    userAddress = await signer.getAddress();

    document.getElementById("userAddress").innerText = userAddress;
    
    const network = await provider.getNetwork();
    document.getElementById("networkChainId").innerText = network.chainId;

    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка подключения кошелька: " + err.message);
  }
}

async function updateContractState() {
  if (!contract) return;
  
  try {
    const nonce = await contract.nonce();
    const isLocked = await contract.isDepositLocked();
    const isStage1 = await contract.isStage1Completed();
    const isStage2 = await contract.isStage2Activated();

    document.getElementById("contractNonce").innerText = nonce.toString();
    document.getElementById("statusDeposit").innerText = isLocked ? "Да" : "Нет";
    document.getElementById("statusStage1").innerText = isStage1 ? "Пройден" : "Нет";
    document.getElementById("statusStage2").innerText = isStage2 ? "Активирован" : "Нет";
  } catch (err) {
    console.error("Ошибка чтения состояния контракта:", err);
  }
}

async function depositAndLock() {
  try {
    const usdtAmount = document.getElementById("usdtDepositInput").value;
    const trxAmount = document.getElementById("trxDepositInput").value;

    const tx = await contract.depositAndLock(usdtAmount, { value: trxAmount });
    await tx.wait();
    alert("Депозит (USDT + 2,000 TRX) успешно внесен и заблокирован!");
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка пополнения депозита: " + err.message);
  }
}

// Локальная генерация подписи для текущего подключенного кошелька (Stage 1)
async function signStage1Local() {
  try {
    const chainId = await contract.chainId();
    const nonce = await contract.nonce();
    const roleTag = document.getElementById("stage1RoleSelect").value;
    const passportHash = document.getElementById("passportHashInput").value;
    
    if (!passportHash || passportHash.length !== 66) {
      return alert("Введите корректный bytes32 хэш (0x... 64 символа)");
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const messageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "string", "bytes32", "uint256", "uint256"],
      [CONTRACT_ADDRESS, chainId, roleTag, passportHash, timestamp, nonce]
    );

    const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
    
    document.getElementById("generatedSigOutput").value = JSON.stringify({
      role: roleTag,
      timestamp: timestamp,
      signature: signature
    }, null, 2);

    alert(`Подпись для ${roleTag} успешно создана!`);
  } catch (err) {
    console.error(err);
    alert("Ошибка генерации подписи Stage 1: " + err.message);
  }
}

// Исполнение Stage 1 передачей 3 собранных подписей
async function executeStage1() {
  try {
    const invPass = document.getElementById("investorPassportInput").value;
    const recPass = document.getElementById("receiverPassportInput").value;
    const oracleCode = document.getElementById("oracleCodeInput").value;

    const timeA = document.getElementById("timeA_Input").value;
    const timeB = document.getElementById("timeB_Input").value;
    const timeOracle = document.getElementById("timeOracle_Input").value;

    const sigA = document.getElementById("sigA_Input").value.trim();
    const sigB = document.getElementById("sigB_Input").value.trim();
    const sigOracle = document.getElementById("sigOracle_Input").value.trim();

    const tx = await contract.signStage1(
      invPass, recPass, oracleCode,
      timeA, timeB, timeOracle,
      sigA, sigB, sigOracle
    );
    await tx.wait();
    
    alert("Этап 1 успешно выполнен в блокчейне!");
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка выполнения Stage 1: " + err.message);
  }
}

// Локальная генерация подписи для Stage 2
async function signStage2Local() {
  try {
    const chainId = await contract.chainId();
    const nonce = await contract.nonce();
    const roleTag = document.getElementById("stage2RoleSelect").value;
    const timestamp = Math.floor(Date.now() / 1000);

    const messageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "string", "uint256", "uint256"],
      [CONTRACT_ADDRESS, chainId, roleTag, timestamp, nonce]
    );

    const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));

    document.getElementById("generatedStage2SigOutput").value = JSON.stringify({
      role: roleTag,
      timestamp: timestamp,
      signature: signature
    }, null, 2);

    alert(`Подпись Stage 2 для ${roleTag} сформирована!`);
  } catch (err) {
    console.error(err);
    alert("Ошибка подписи Stage 2: " + err.message);
  }
}

// Исполнение Stage 2 и распределение комиссий
async function executeStage2() {
  try {
    const timeA = document.getElementById("s2_timeA_Input").value;
    const timeB = document.getElementById("s2_timeB_Input").value;
    const timeOracle = document.getElementById("s2_timeOracle_Input").value;

    const sigA = document.getElementById("s2_sigA_Input").value.trim();
    const sigB = document.getElementById("s2_sigB_Input").value.trim();
    const sigOracle = document.getElementById("s2_sigOracle_Input").value.trim();

    const tx = await contract.executeStage2AndDistribute(
      timeA, timeB, timeOracle,
      sigA, sigB, sigOracle
    );
    await tx.wait();

    alert("Этап 2 выполнен! Комиссии распределены, остаток депозита возвращен Приемке.");
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка выполнения Stage 2: " + err.message);
  }
}

async function withdrawAfterLockTimeout() {
  try {
    const tx = await contract.withdrawAfterLockTimeout();
    await tx.wait();
    alert("Средства успешно выведены по истечении 120 рабочих часов!");
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка вывода по тайм-ауту: " + err.message);
  }
}

async function emergencyRefund() {
  try {
    const tx = await contract.emergencyRefundAfterTimeout();
    await tx.wait();
    alert("Аварийный возврат средств выполнен!");
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка аварийного возврата: " + err.message);
  }
}
