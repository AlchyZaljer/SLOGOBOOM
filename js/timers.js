// отрисовка таймера
function timerRenderer(counter, deadline) {
    const $progress = $('#progress'); // сохранение поля таймера
    $progress.css('background', 'none'); // скрытие дефолтного цвета полосы таймера
    // вычисление процентного значения текущего таймера относительно его полного значения
    let percentage = counter * 100 / deadline;
    // анимация изменения ширины
    $progress.animate({
        width: `${percentage}%`
    });
    // добавление значения percentage в соответствующий атрибут
    $progress.attr('aria-valuenow', percentage);
    // смена цвета полосы таймера в зависимости от велицины
    if (percentage >= 75) {
        $progress.css('background', 'var(--colorG)');
    } else if (percentage >= 50) {
        $progress.css('background', 'var(--colorY)');
    } else if (percentage >= 25) {
        $progress.css('background', 'var(--colorO)');
    } else {
        $progress.css('background', 'var(--colorR)');
    }
}