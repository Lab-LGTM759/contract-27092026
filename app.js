// TRON Base58 адрес развернутого контракта в сети Shasta Testnet
const CONTRACT_ADDRESS_BASE58 = "TLEHBvmyqueaBJErZfe2QWw8qLwKEaEe8A";
// EVM Hex эквивалент контракта (используется для генерации хэшей подписи)
const CONTRACT_ADDRESS_HEX = "0x708afe235a9b4e7616dbdb0e74c7d239b1a130f2";
const CHAIN_ID = 728126428;

const CONTRACT_ABI = [
  {
    "inputs": [],
    "name": "nonce",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "isDepositLocked",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "isStage1Completed",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "isStage2Activated",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "usdtAmount", "type": "uint256"}],
    "name": "depositAndLock",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "investorPassport", "type": "bytes32"},
      {"name": "receiverPassport", "type": "bytes32"},
      {"name": "oracleCode", "type": "bytes32"},
      {"name": "timeA", "type": "uint256"},
      {"name": "timeB", "type": "uint256"},
      {"name": "timeOracle", "type": "uint256"},
      {"name": "sigA", "type": "bytes"},
      {"name": "sigB", "type": "bytes"},
      {"name": "sigOracle", "type": "bytes"}
    ],
    "name": "signStage1",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "timeA", "type": "uint256"},
      {"name": "timeB", "type": "uint256"},
      {"name": "timeOracle", "type": "uint256"},
      {"name": "sigA", "type": "bytes"},
      {"name": "sigB", "type": "bytes"},
      {"name": "sigOracle", "type": "bytes"}
    ],
    "name": "executeStage2AndDistribute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "withdrawAfterLockTimeout",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "emergencyRefundAfterTimeout",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

let contract;
let userAddress;

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("connectWalletBtn").addEventListener("click", connectWallet);
  document.getElementById("showQrBtn").addEventListener("click", toggleQrModal);
  document.getElementById("closeQrBtn").addEventListener("click", toggleQrModal);
  
  document.getElementById("depositBtn").addEventListener("click", depositAndLock);
  document.getElementById("signStage1MsgBtn").addEventListener("click", signStage1Local);
  document.getElementById("execStage1Btn").addEventListener("click", executeStage1);
  document.getElementById("signStage2MsgBtn").addEventListener("click", signStage2Local);
  document.getElementById("execStage2Btn").addEventListener("click", executeStage2);
  document.getElementById("withdrawLockTimeoutBtn").addEventListener("click", withdrawAfterLockTimeout);
  document.getElementById("emergencyRefundBtn").addEventListener("click", emergencyRefund);

  // Автоподключение при открытии, если TronLink уже разблокирован
  setTimeout(connectWallet, 500);
});

async function connectWallet() {
  if (window.tronLink) {
    try {
      const res = await window.tronLink.request({ method: 'tron_requestAccounts' });
      
      if (res.code === 200 || window.tronWeb) {
        userAddress = window.tronWeb.defaultAddress.base58;
        document.getElementById("userAddress").innerText = userAddress;
        document.getElementById("networkChainId").innerText = "TRON Shasta Testnet";

        // Подключаем контракт через нативный TronWeb API
        contract = await window.tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS_BASE58);

        updateQrCode(userAddress);
        await updateContractState();
      } else {
        alert("Пожалуйста, подпишите запрос на подключение в расширении TronLink.");
      }
    } catch (err) {
      console.error(err);
      alert("Ошибка автоподключения TronLink: " + err.message);
    }
  } else if (window.tronWeb && window.tronWeb.defaultAddress.base58) {
    userAddress = window.tronWeb.defaultAddress.base58;
    document.getElementById("userAddress").innerText = userAddress;
    document.getElementById("networkChainId").innerText = "TRON Shasta Testnet";
    
    contract = await window.tronWeb.contract(CONTRACT_ABI, CONTRACT_ADDRESS_BASE58);
    updateQrCode(userAddress);
    await updateContractState();
  } else {
    alert("Расширение TronLink не обнаружено! Пожалуйста, установите TronLink.");
  }
}

function toggleQrModal() {
  const modal = document.getElementById("qrModal");
  modal.classList.toggle("hidden");
  
  if (!modal.classList.contains("hidden")) {
    updateQrCode(userAddress || CONTRACT_ADDRESS_BASE58);
  }
}

function updateQrCode(data) {
  const container = document.getElementById("qrcode");
  container.innerHTML = "";
  
  if (typeof QRCode !== "undefined" && data) {
    new QRCode(container, {
      text: data,
      width: 180,
      height: 180,
      colorDark: "#ffffff",
      colorLight: "#1e293b",
      correctLevel: QRCode.CorrectLevel.H
    });
    document.getElementById("qrAddressText").innerText = data;
  }
}

async function updateContractState() {
  if (!contract) return;
  
  try {
    const nonce = await contract.nonce().call();
    const isLocked = await contract.isDepositLocked().call();
    const isStage1 = await contract.isStage1Completed().call();
    const isStage2 = await contract.isStage2Activated().call();

    document.getElementById("contractNonce").innerText = nonce.toString();
    document.getElementById("statusDeposit").innerText = isLocked ? "Да" : "Нет";
    document.getElementById("statusStage1").innerText = isStage1 ? "Пройден" : "Нет";
    document.getElementById("statusStage2").innerText = isStage2 ? "Активирован" : "Нет";
  } catch (err) {
    console.error("Ошибка чтения состояния контракта через TronWeb:", err);
  }
}

async function depositAndLock() {
  if (!contract) return alert("Сначала подключите кошелек!");
  
  try {
    const usdtAmount = document.getElementById("usdtDepositInput").value;
    const trxAmount = document.getElementById("trxDepositInput").value; // 2000000000 SUN

    // Вызов с передачей нативного TRX через параметр callValue (в SUN)
    const txHash = await contract.depositAndLock(usdtAmount).send({
      callValue: trxAmount
    });

    alert("Депозит успешно отправлен! TxHash: " + txHash);
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка пополнения депозита: " + (err.message || err));
  }
}

async function signStage1Local() {
  if (!window.tronWeb) return alert("Подключите TronLink!");

  try {
    const nonceObj = await contract.nonce().call();
    const nonce = nonceObj.toString();
    const roleTag = document.getElementById("stage1RoleSelect").value;
    const passportHash = document.getElementById("passportHashInput").value;
    
    if (!passportHash || passportHash.length !== 66) {
      return alert("Введите корректный bytes32 хэш (начиная с 0x, ровно 66 символов)");
    }

    const timestamp = Math.floor(Date.now() / 1000);

    // Вычисление Keccak256 хэша
    const messageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "string", "bytes32", "uint256", "uint256"],
      [CONTRACT_ADDRESS_HEX, CHAIN_ID, roleTag, passportHash, timestamp, nonce]
    );

    // Подпись хэша через TronWeb
    const signature = await window.tronWeb.trx.signMessageV2(messageHash);
    
    document.getElementById("generatedSigOutput").value = JSON.stringify({
      role: roleTag,
      timestamp: timestamp,
      signature: signature
    }, null, 2);

    alert(`Подпись для ${roleTag} успешно сформирована!`);
  } catch (err) {
    console.error(err);
    alert("Ошибка генерации подписи: " + (err.message || err));
  }
}

async function executeStage1() {
  if (!contract) return alert("Подключите кошелек!");

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

    const txHash = await contract.signStage1(
      invPass, recPass, oracleCode,
      timeA, timeB, timeOracle,
      sigA, sigB, sigOracle
    ).send();
    
    alert("Этап 1 успешно выполнен! TxHash: " + txHash);
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка выполнения Stage 1: " + (err.message || err));
  }
}

async function signStage2Local() {
  if (!window.tronWeb) return alert("Подключите TronLink!");

  try {
    const nonceObj = await contract.nonce().call();
    const nonce = nonceObj.toString();
    const roleTag = document.getElementById("stage2RoleSelect").value;
    const timestamp = Math.floor(Date.now() / 1000);

    const messageHash = ethers.utils.solidityKeccak256(
      ["address", "uint256", "string", "uint256", "uint256"],
      [CONTRACT_ADDRESS_HEX, CHAIN_ID, roleTag, timestamp, nonce]
    );

    const signature = await window.tronWeb.trx.signMessageV2(messageHash);

    document.getElementById("generatedStage2SigOutput").value = JSON.stringify({
      role: roleTag,
      timestamp: timestamp,
      signature: signature
    }, null, 2);

    alert(`Подпись Stage 2 для ${roleTag} сформирована!`);
  } catch (err) {
    console.error(err);
    alert("Ошибка подписи Stage 2: " + (err.message || err));
  }
}

async function executeStage2() {
  if (!contract) return alert("Подключите кошелек!");

  try {
    const timeA = document.getElementById("s2_timeA_Input").value;
    const timeB = document.getElementById("s2_timeB_Input").value;
    const timeOracle = document.getElementById("s2_timeOracle_Input").value;

    const sigA = document.getElementById("s2_sigA_Input").value.trim();
    const sigB = document.getElementById("s2_sigB_Input").value.trim();
    const sigOracle = document.getElementById("s2_sigOracle_Input").value.trim();

    const txHash = await contract.executeStage2AndDistribute(
      timeA, timeB, timeOracle,
      sigA, sigB, sigOracle
    ).send();

    alert("Этап 2 выполнен! Комиссии распределены. TxHash: " + txHash);
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка выполнения Stage 2: " + (err.message || err));
  }
}

async function withdrawAfterLockTimeout() {
  if (!contract) return alert("Подключите кошелек!");

  try {
    const txHash = await contract.withdrawAfterLockTimeout().send();
    alert("Средства выведены по тайм-ауту! TxHash: " + txHash);
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка вывода: " + (err.message || err));
  }
}

async function emergencyRefund() {
  if (!contract) return alert("Подключите кошелек!");

  try {
    const txHash = await contract.emergencyRefundAfterTimeout().send();
    alert("Аварийный возврат выполнен! TxHash: " + txHash);
    await updateContractState();
  } catch (err) {
    console.error(err);
    alert("Ошибка аварийного возврата: " + (err.message || err));
  }
}
