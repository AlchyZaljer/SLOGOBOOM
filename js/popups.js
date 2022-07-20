// открытие попапа
function popupOpen($popup) {
    $popup.addClass('open'); // добавление открывающего класса

    // если не имеет ограничивающего класса
    if (!$popup.hasClass('nonClosing')) {
        // клик по попапу
        $popup.click((element) => {
            // если не кликнута область внутри .popupWrapper
            if (!element.target.closest('.popupWrapper')) {
                popupClose($popup); // запуск закрытия попапа
            }
        });
    }

    // клик по значку закрытия
    $('#closer').click((element) => {
        element.preventDefault(); // предотвращение дефолтного поведения
        popupClose($popup); // запуск закрытия попапа
    });
}

// закрытие попапа
function popupClose($popup) {
    $popup.removeClass('open'); // удаление открывающего класса
}