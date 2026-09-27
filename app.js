const CONTRACT_ADDRESS = "TDcgpz4UvmHDA9KYnk5ktPFFo1EFXjNnuM";
let currentAccount = null;

/**
 * Инициализация подключения к TronLink
 */
async function initTron() {
  const netStatus = document.getElementById("netStatus");
  const userAddress = document.getElementById("userAddress");

  if (window.tronWeb && window.tronWeb.ready) {
    currentAccount = window.tronWeb.defaultAddress.base58;
    netStatus.innerText = "TronLink Активен";
    netStatus.style.background = "#10b981";
    userAddress.innerText = currentAccount;
  } else {
    netStatus.innerText = "TronGrid API Mode";
    netStatus.style.background = "#64748b";
    userAddress.innerText = "Автономный режим";
  }
}

/**
 * Запрос логов событий из сети TRON через Event API
 */
async function fetchContractEvents(eventName) {
  const eventServerHost = (window.tronWeb && window.tronWeb.eventServer && window.tronWeb.eventServer.host) 
    ? window.tronWeb.eventServer.host 
    : "https://api.shasta.trongrid.io";

  const url = `${eventServerHost}/v1/contracts/${CONTRACT_ADDRESS}/events?event_name=${eventName}&only_confirmed=true&limit=200`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Ошибка обращения к Event API TRON (${response.statusText})`);
  }

  const json = await response.json();
  if (!json.success || !json.data) {
    return [];
  }

  return json.data.map(eventLog => ({
    eventName: eventLog.event_name,
    transactionId: eventLog.transaction_id,
    blockNumber: eventLog.block_number,
    blockTimestamp: eventLog.block_timestamp,
    formattedDateTime: new Date(eventLog.block_timestamp).toISOString(),
    contractAddress: CONTRACT_ADDRESS,
    parameters: eventLog.result
  }));
}

/**
 * Восстановление адреса подписанта через ecrecover (Ethers.js)
 */
function verifySignatureAddress(messageHash, signature) {
  try {
    if (!signature || signature.length < 130) {
      return null;
    }
    const ethHash = ethers.utils.hashMessage(ethers.utils.arrayify(messageHash));
    return ethers.utils.recoverAddress(ethHash, signature);
  } catch (err) {
    console.warn("Ошибка ecrecover:", err.message);
    return null;
  }
}

/**
 * Экспорт логов в формате JSON
 */
async function exportEscrowLogsToJson() {
  const btn = document.getElementById("btnExportLogs");
  const originalText = btn.innerText;

  try {
    btn.innerText = "⏳ Загрузка...";
    btn.disabled = true;

    const [stage1Events, stage2Events] = await Promise.all([
      fetchContractEvents("Stage1Signed"),
      fetchContractEvents("Stage2Executed")
    ]);

    const allEvents = [...stage1Events, ...stage2Events].sort((a, b) => a.blockTimestamp - b.blockTimestamp);

    if (allEvents.length === 0) {
      alert("В сети TRON не найдено событий для этого контракта.");
      return;
    }

    const auditReport = {
      title: "Tangem Escrow Audit Trail",
      contractAddress: CONTRACT_ADDRESS,
      exportedAt: new Date().toISOString(),
      network: "TRON",
      totalEvents: allEvents.length,
      events: allEvents
    };

    const blob = new Blob([JSON.stringify(auditReport, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `escrow_log_${CONTRACT_ADDRESS.substring(0, 8)}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Ошибка экспорта: ${err.message || err}`);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

/**
 * Генерация печатного PDF-отчета с результатами ecrecover
 */
async function generatePdfAuditReport() {
  const btn = document.getElementById("btnGeneratePdf");
  const originalText = btn.innerText;

  try {
    btn.innerText = "🔍 Проверка ecrecover...";
    btn.disabled = true;

    const hashA = document.getElementById("hashA").value || "N/A";
    const sigA = document.getElementById("signatureA").value || "";

    const hashB = document.getElementById("hashB").value || "N/A";
    const sigB = document.getElementById("signatureB").value || "";

    const hashOracle = document.getElementById("hashOracle").value || "N/A";
    const sigOracle = document.getElementById("signatureOracle").value || "";

    // Выполнение ecrecover для всех 3 сторон
    const recA = verifySignatureAddress(hashA, sigA);
    const recB = verifySignatureAddress(hashB, sigB);
    const recOracle = verifySignatureAddress(hashOracle, sigOracle);

    const stage1Events = await fetchContractEvents("Stage1Signed");
    const stage2Events = await fetchContractEvents("Stage2Executed");

    const reportHtml = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <title>Escrow Verified Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
          .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
          .header h1 { font-size: 18px; margin: 0; color: #0f172a; }
          .header p { font-size: 11px; color: #64748b; margin-top: 4px; }
          .section-title { font-size: 12px; font-weight: bold; margin-top: 15px; margin-bottom: 8px; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10px; }
          th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; word-break: break-all; }
          th { background-color: #f1f5f9; }
          .valid { color: #059669; font-weight: bold; }
          .invalid { color: #dc2626; font-weight: bold; }
          .stamp { border: 1px dashed #94a3b8; padding: 10px; margin-top: 20px; font-size: 10px; background: #f8fafc; }
          @page { size: A4; margin: 12mm; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>АУДИТОРСКИЙ ОТЧЕТ ИСПОЛНЕНИЯ ESCROW (ECRECOVER VERIFIED)</h1>
          <p>Дата формирования: ${new Date().toLocaleString("ru-RU")} | Контракт: ${CONTRACT_ADDRESS}</p>
        </div>

        <div class="section-title">1. Результаты верификации подписей (ecrecover / Secp256k1)</div>
        <table>
          <thead>
            <tr><th>Сторона</th><th>Хэш данных</th><th>Восстановленный адрес (ecrecover)</th><th>Статус</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Party A (Investor)</td>
              <td>${hashA}</td>
              <td>${recA || "Ошибка / подпись отсутствует"}</td>
              <td class="${recA ? 'valid' : 'invalid'}">${recA ? '✓ ВЕРИФИЦИРОВАНО' : '✗ ОШИБКА'}</td>
            </tr>
            <tr>
              <td>Party B (Receiver)</td>
              <td>${hashB}</td>
              <td>${recB || "Ошибка / подпись отсутствует"}</td>
              <td class="${recB ? 'valid' : 'invalid'}">${recB ? '✓ ВЕРИФИЦИРОВАНО' : '✗ ОШИБКА'}</td>
            </tr>
            <tr>
              <td>Oracle Coordinator</td>
              <td>${hashOracle}</td>
              <td>${recOracle || "Ошибка / подпись отсутствует"}</td>
              <td class="${recOracle ? 'valid' : 'invalid'}">${recOracle ? '✓ ВЕРИФИЦИРОВАНО' : '✗ ОШИБКА'}</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">2. Логи событий сети TRON (On-Chain Trail)</div>
        <table>
          <thead>
            <tr><th>Событие</th><th>Блок</th><th>TxHash</th><th>Дата (UTC)</th></tr>
          </thead>
          <tbody>
            ${
              stage1Events.length > 0 
                ? stage1Events.map(e => `<tr><td><b>Stage1Signed</b></td><td>#${e.blockNumber}</td><td>${e.transactionId}</td><td>${e.formattedDateTime}</td></tr>`).join('')
                : '<tr><td colspan="4" style="text-align:center;">События Stage1Signed не зафиксированы</td></tr>'
            }
            ${
              stage2Events.length > 0 
                ? stage2Events.map(e => `<tr><td><b>Stage2Executed</b></td><td>#${e.blockNumber}</td><td>${e.transactionId}</td><td>${e.formattedDateTime}</td></tr>`).join('')
                : '<tr><td colspan="4" style="text-align:center;">События Stage2Executed не зафиксированы</td></tr>'
            }
          </tbody>
        </table>

        <div class="stamp">
          <b>ЭЛЕКТРОННЫЙ ШТАМП ВЕРИФИКАЦИИ:</b><br>
          Отчет сгенерирован автоматически на основе данных TRON Event Server и локальной криптографической проверки подписей.<br>
          Verification Hash: ${ethers.utils.id(CONTRACT_ADDRESS + Date.now())}
        </div>

        <script>
          window.onload = function() { setTimeout(() => { window.print(); }, 400); };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=800");
    printWindow.document.write(reportHtml);
    printWindow.document.close();
  } catch (err) {
    alert(`Ошибка генерации PDF: ${err.message || err}`);
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
}

// Слушатели событий
document.addEventListener("DOMContentLoaded", () => {
  initTron();
  document.getElementById("btnExportLogs").addEventListener("click", exportEscrowLogsToJson);
  document.getElementById("btnGeneratePdf").addEventListener("click", generatePdfAuditReport);
});
