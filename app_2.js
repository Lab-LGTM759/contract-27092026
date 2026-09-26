// Константы распределения долей для 5 получателей (в сумме 1100 BPS = 11.00%):
// [500, 175, 175, 150, 100]
const EXPECTED_BPS = [500, 175, 175, 150, 100];

document.getElementById('updatePayeesBtn').addEventListener('click', async () => {
    try {
        // Собираем значения из 5 полей ввода
        const wallets = [
            document.getElementById('payee0').value.trim(),
            document.getElementById('payee1').value.trim(),
            document.getElementById('payee2').value.trim(),
            document.getElementById('payee3').value.trim(),
            document.getElementById('payee4').value.trim()
        ];

        // Простая валидация на заполненность
        for (let i = 0; i < wallets.length; i++) {
            if (!wallets[i]) {
                alert(`Пожалуйста, заполните адрес для кошелька с индексом ${i}`);
                return;
            }
        }

        console.log("Обновление кошельков с долями (BPS):", {
            wallets,
            bps: EXPECTED_BPS
        });

        // Вызов метода контракта
        // Пример: await contract.updatePayeeWallets(wallets, EXPECTED_BPS).send();
        
        alert('Кошельки успешно подготовлены к обновлению!');
    } catch (error) {
        console.error("Ошибка при обновлении кошельков:", error);
        alert('Произошла ошибка. Подробности в консоли.');
    }
});
