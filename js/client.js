// работа после полной загрузки документа
$(document).ready(() => {

    // массив из 7 цветов для стилизации сообщений игроков
    const colors = [
        '#ff5e44',
        '#ff8544',
        '#ffe444',
        '#00ff00',
        '#5fc3e4',
        '#435cff',
        '#e55d87'
    ]

    // инициализация сокета
    const socket = io.connect();

    // сохранение необходимых полей
    const $authorization = $('.authorization');
    const $game = $('.game');
    const $info = $('#popupInfo');
    const $waiting = $('#popupWaiting');
    const $result = $('#popupResult');
    const $initialForm = $('#initialForm');
    const $name = $('#name');
    const $syllable = $('#syllable');
    const $progress = $('#progress');
    const $status = $("#status");
    const $messages = $('#messages');
    const $chatForm = $('#chatForm');
    const $message = $("#message");
    const $sendBtn = $('#sendBtn');
    const $round = $('.round');
    const $lastRound = $('#lastRound');
    const $totalRound = $('#totalRound');
    const $lastSyllable = $('.lastSyllable');
    const $lastSyllableText = $('#lastSyllableText');
    const $gameOver = $('#gameOver');
    const $roundOver = $('#roundOver');
    const $winner = $('#winner');
    const $in = $('#in');
    const $out = $('#out');

    // клик по значку информации
    $('#i').click((element) => {
        element.preventDefault(); // предотвращение дефолтного поведения
        popupOpen($info); // запуск открытия информационного попапа
    });

    // отправка формы авторизации
    $initialForm.submit((event) => {
        event.preventDefault(); // предотвращение дефолтного поведения
        popupOpen($waiting); // запуск открытия попапа ожидания
        // отправка события начала поиска игры
        socket.emit('game search started', $name.val());
    });

    // клик по кнопке отсановки поиска
    $('#breakWaitingBtn').click((element) => {
        element.preventDefault(); // предотвращение дефолтного поведения
        popupClose($waiting); // запуск закрытия попапа ожидания
        // отправка события остановки поиска игры
        socket.emit('game search stopped', $name.val());
    });

    // получение события создания игрового окна
    socket.on('room creating', (syllable) => {
        document.title = 'SLOGOBOOM | Игра'; // замена заголовка
        popupClose($waiting); // запуск закрытия попапа ожидания
        $authorization.addClass('unseen'); // скрытие полей авторизации
        $game.removeClass('unseen'); // открытие полей игры
        $syllable.text(syllable); // отображение слога
    });

    // получение приветственных сообщений с именами подключенных к комнате
    socket.on('greeting to roommates', (username) => {
        // добавление сообщения в конец поля сообщений
        $messages.append(`<div class='messageString serverMessage'><b>${username}</b> в игре</div>`);
    });

    // получение события выхода из комнаты
    socket.on('farewell to roommates', (username) => {
        // добавление сообщения в конец поля сообщений
        $messages.append(`<div class='messageString serverMessage'><b>${username}</b> покинул(а) игру</div>`);
        // промотка сообщений вниз к последнему
        $messages.animate({
            scrollTop: $messages[0].scrollHeight
        }, 100);
    });

    // получение события посекундной отрисовки таймера
    socket.on('timer rendering', (counter, deadline) => {
        timerRenderer(counter, deadline); // запуск отрисовки таймера
    });

    // получение события нового хода
    socket.on('new move', (username) => {
        // вывод сообщения в поле статуса
        $status.html(`отвечает <b>${username}</b>`);
    });

    // получение события текущего хода у актуального игрока
    socket.on('current move', () => {
        // вывод сообщения в поле статуса
        $status.html('ваш ход');
        // отключение полей формы
        $message.removeAttr('disabled');
        $sendBtn.removeAttr('disabled');
    });

    // получение события ввода сообщения
    $message.on('input', () => {
        const syllable = $syllable.text().toUpperCase(); // значение слога без учета регистра
        const text = $message.val().toUpperCase(); // текст сообщения без учета регистра
        // если содежит соответствующее буквосочетание
        if (text.includes(syllable)) {
            $message[0].setCustomValidity(""); // нет ошибки
        } else {
            // вывод кастомного сообщения об ошибке валидации
            $message[0].setCustomValidity("Введенное слово не содержит соответствующее буквосочетание!");
        }
    });

    // отправка формы сообщения
    $chatForm.submit((event) => {
        event.preventDefault(); //предотвращение дефолтного поведения
        // отправка события отправленного сообщения
        socket.emit('sending message', {
            message: $message.val()
        });
        $message.val(''); // очистка поля сообщения
        // отключение полей формы
        $message.attr('disabled', 'disabled');
        $sendBtn.attr('disabled', 'disabled');
    });

    // получение события добавления сообщения
    socket.on('adding message', (data) => {
        // добавление сообщения в конец поля сообщений
        $messages.append(`<div class='messageString' style='background-color: ${colors[data.color]}4D'><b style='color: ${colors[data.color]}'> ${data.name} </b>: ${data.message} </div>`);
        // промотка сообщений вниз к последнему
        $messages.animate({
            scrollTop: $messages[0].scrollHeight
        }, 100);
    });

    // получение события конца раунда
    socket.on('round over', (data) => {
        $message.val(''); // очистка поля сообщения
        // отключение полей формы
        $message.attr('disabled', 'disabled');
        $sendBtn.attr('disabled', 'disabled');
        $status.html(`раунд ${data.last} завершен`); // вывод сообщения в поле статуса
        $status.css({'color' : 'var(--color7)'}); // изменение цвета поля статуса
        $totalRound.text(data.total); // отображение общего количества раундов
        $lastRound.text(data.last); // отображение номера прошедшего раунд
        $lastSyllableText.text($syllable.text()); // отображение слога из прошедшего раунда
        // добавление имени выбывшего из игры
        $out.append(`<div class="name" style='color: ${colors[data.out[0][1]]}'>${data.out[0][0]}</div>`);
        // добавление имен оставшихся в игре
        data.in.forEach((element) => {
            $in.append(`<div class="name" style='color: ${colors[element[1]]}'>${element[0]}</div>`);
        });
        popupOpen($result); // запуск открытия попапа с результатом раунда
    });

    // получение события создания нового раунда
    socket.on('new round creating', (syllable) => {
        popupClose($result); // запуск закрытия попапа с результатом раунда
        $status.css({'color' : 'var(--color5)'}); // изменение цвета поля статуса
        $progress.css('background', 'var(--colorG)'); // обнуление цвета полосы таймера
        $syllable.text(syllable); // отображение слога
        $out.empty(); // очистка поля выбывших из игры
        $in.empty(); // очистка поля оставшихся в игре
    });

    // получение события конца игры
    socket.on('game over', (username, color) => {
        $message.val(''); // очистка поля сообщения
        // отключение полей формы
        $message.attr('disabled', 'disabled');
        $sendBtn.attr('disabled', 'disabled');
        $status.html(`игра окончена`); // вывод сообщения в поле статуса
        $status.css({'color' : 'var(--color7)'}); // изменение цвета поля статуса
        $roundOver.addClass('unseen'); // отключение поля результатов раунда
        $lastSyllable.addClass('unseen'); // отключение поля слога
        $gameOver.removeClass('unseen'); // включение поля победителя
        $round.empty(); // очистка поля заголовка
        $round.html(`Конец игры`); // отображение заголовка конца игры
        // добавление победителя в конец поля сообщений
        $winner.append(`<div class="name" style='color: ${colors[color]}'>${username}</div>`);
        popupOpen($result); // запуск открытия попапа с результатом раунда
    });

    // получение события удаления из игры
    socket.on('removal from game', () => {
        location.reload(); // перезагрузка страницы
    });
});