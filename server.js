// подключение модулей
const express = require('express'); // фреймворк с абстракциями
const app = express();
const http = require('http');
const server = http.createServer(app);
const io = require('socket.io')(server); // библиотека для обмена данными в реальном времени
const path = require('path'); // утилиты для работы с путями к файлам и каталогам
const utils = require('./js/utils');
const syllables = require('./js/syllables');
// удалить?
// const mysql = require('mysql');
// const { config } = require('process');

app.set('view engine', 'ejs'); // задать EJS как механизм просмотра

const PORT = 80;

const MAX_PLAYERS = 5;

const ROUNDS_NUBER = MAX_PLAYERS - 1;

// генерация пути к файлу
const createPath = (page) => path.resolve(__dirname, 'views', `${page}.ejs`);

// запуск сервера
server.listen(PORT, (error) => {
    error ? console.log(error) : console.log(`listening port ${PORT}`);
});

// middlewares
app.use(express.static('css'));
app.use(express.static('fonts'));
app.use(express.static('img'));
app.use(express.static('js'));

// основная страница
app.get('/', (req, res) => {
    res.render(createPath('index'))
});

let connections = []; // массив подключенных
let waitings = []; // массив ожидающих
let rooms = []; // массив комнат

// получение подключения
io.sockets.on('connection', (socket) => {
    console.log('connection'); 
    connections.push(socket); // добавление в массив подключенных

    // получение отключения
    socket.on('disconnect', () => {
        console.log('disconnection');
        roomCheck(socket); // запуск проверки комнаты
        connections.splice(connections.indexOf(socket), 1); // удаление сокета из массива подключенных
        // если находится в ожидающих
        waitings.forEach((i) => {
            if (i == socket) {
                waitings.splice(waitings.indexOf(i), 1); // удаление сокета из массива ожидающих
            }
        });
    });

    // получение события начала поиска игры
    socket.on('game search started', (data) => {
        console.log(`${data} started game searching`);
        socket.username = data; // сохранение имени в сокете
        waitings.push(socket); // добавление в массив ожидающих
        // запуск проверки количества игроков в массиве ожидания
        waitingsCheck(waitings); // запуск проверки количества игроков в массиве ожидания
    });

    // получение события остановки поиска игры
    socket.on('game search stopped', (data) => {
        console.log(`${data} stopped game searching`);
        // если находится в ожидающих
        waitings.forEach((i) => {
            if (i == socket) {
                waitings.splice(waitings.indexOf(i), 1); // удаление сокета из массива ожидающих
            }
        });
    });

    // получение события отправленного сообщения
    socket.on('sending message', (data) => {
        let room;
        let color;
        let currentPlayerName;
        let currentPlayerSocket;
        rooms.forEach((block) => {
            for (let i = 0; i < block[1].length; i++) {
                // если находится в комнате
                if (block[1][i][0].id == socket.id) {
                    room = block[0]; // получение номера комнаты
                    console.log(room + ' : ' + socket.username + ' - ' + data.message);
                    color = block[1][i][1]; // получение номера цвета
                    block[1][i][2] = 0; // сброс статуса текущего хода
                    // если в списке есть следующий игрок по порядку, то передать ход
                    if (block[1][i + 1]) {
                        currentPlayerName = block[1][i + 1][0].username;
                        currentPlayerSocket = block[1][i + 1][0];
                        block[1][i + 1][2] = 1;
                    }
                    // или передать ход первому игроку в списке
                    else {
                        currentPlayerName = block[1][0][0].username;
                        currentPlayerSocket = block[1][0][0];
                        block[1][0][2] = 1;
                    }
                    // отправка события нового хода всей комнате
                    io.in(room).emit('new move', currentPlayerName);
                    // отправка уведомления о текущем ходе актуальному игроку
                    currentPlayerSocket.emit('current move');
                    break;
                }
            }
        });
        // отправка события добавления сообщения всей комнате
        io.in(room).emit('adding message', {
            message: data.message,
            name: socket.username,
            color: color
        });
    });
});

// проверка количества игроков в массиве ожидания
function waitingsCheck(waitings) {
    // если количество игроков набрано
    if (waitings.length == MAX_PLAYERS) {
        const room = waitings[0].id; // название комнаты = id первого игрока в листе ожидания
        console.log(`room ${room} created`);
        waitings.forEach((i) => i.join(room)); // отправка всех из листа ожидания в комнату
        waitings.length = 0; // очистка листа ожидания
        // полуение рандомного слога из массива из 100 слогов
        const syllable = syllables[utils.getRandomInt(0, syllables.length - 1)];
        // отправка события создания игрового окна в комнате
        io.in(room).emit('room creating', syllable);
        firstRound(room); // запуск первого раунда
    }
}

// первый раунд
async function firstRound(room) {
    console.log(`round 1 started in room ${room}`);
    let queue = await io.of("/").in(room).fetchSockets(); // сокеты находящихся в комнате
    for (let i = 0, j = 0; i < queue.length; i++, j++) {
        let username = queue[i].username;
        // отправка приветственных сообщений с именами подключенных к комнате
        io.in(room).emit('greeting to roommates', username);
        (j == 7) ? (j = 0) : j;
        // добавление каждому игроку номера цвета (от 1 до 7) и поля статуса хода
        queue[i] = [queue[i], j, 0];
    }
    rooms.push([room, queue, 1]); // массив [[№ комнаты, [[сокет, № цвета, статус текущего хода], [...], ...], № раунда], ...]
    const counter = utils.getRandomInt(120, 300); // получение равндомного значения таймера (2-5 мин)
    console.log(`room ${room} timer: ${counter}`);
    setTimeout(() => {
        // задание первого ходящего игрока в очереди
        let currentPlayerName = queue[0][0].username;
        let currentPlayerId = queue[0][0].id;
        let currentPlayerSocket = queue[0][0];
        // выставление статуса текущего хода
        rooms.forEach((block) => {
            block[1].forEach((player) => {
                if (player[0].id == currentPlayerId) {
                    player[2] = 1;
                }
            })
        });
        // отправка события нового хода всей комнате
        io.in(room).emit('new move', currentPlayerName);
        // отправка уведомления о текущем ходе актуальному игроку
        currentPlayerSocket.emit('current move');
        timer(counter, counter, room); // запуск таймера
    }, 100);
}

// таймер
async function timer(buf, deadline, room) {
    let counter = buf;
    // отправка события посекундной отрисовки таймера всей комнате
    io.in(room).emit('timer rendering', counter, deadline);
    counter -= 1;
    // если текущее значение счетчика не меньше 0
    if (counter >= 0) {
        setTimeout(() => {
            timer(counter, deadline, room);
        }, 1000)
    } else {
        roundCheck(room); // запуск проверки раунда
    }
}

// проверка комнаты
async function roomCheck(socket) {
    rooms.forEach((block) => {
        for (let i = 0; i < block[1].length; i++) {
            // если находится в комнате
            if (block[1][i][0].id == socket.id) {
                let room = block[0];
                let username = block[1][i][0].username;
                let outSocket = block[1][i][0];
                // если имеет статус текущего хода
                if (block[1][i][2] == 1) {
                    let currentPlayerName;
                    let currentPlayerSocket;
                    // если в списке есть следующий игрок по порядку, то передать ход
                    if (block[1][i + 1]) {
                        currentPlayerName = block[1][i + 1][0].username;
                        currentPlayerSocket = block[1][i + 1][0];
                        block[1][i + 1][2] = 1;
                    }
                    // или передать ход первому игроку в списке
                    else {
                        currentPlayerName = block[1][0][0].username;
                        currentPlayerSocket = block[1][0][0];
                        block[1][0][2] = 1;
                    }
                    // отправка события нового хода всей комнате
                    io.in(room).emit('new move', currentPlayerName);
                    // отправка уведомления о текущем ходе актуальному игроку
                    currentPlayerSocket.emit('current move');
                }
                //outSocket.leave(room); // удаление игрока из комнаты
                outSocket.emit('removal from game'); // отправка события удаления из игры отключившимуся
                block[1].splice(i, 1); // удаление игрока из массива подключенных к комнате
                // отправка события выхода из комнаты игрока всей комнате
                io.in(room).emit('farewell to roommates', username);
                break;
            }
        }
    });
}

// проверка раунда
async function roundCheck(room) {
    let inArr = [];
    let outArr = [];
    let outSocket;
    let round;
    let lastRoundFlag = false; // флаг последнего раунда
    rooms.forEach((block) => {
        // доступ к данной комнате
        if (block[0] == room) {
            round = block[2]; // сохранение текущего раунда
            // если в комнате только один или два игрока
            if (block[1].length == 1 || block[1].length == 2) {
                lastRoundFlag = true; // выставление флага
            }
            block[1].forEach((player) => {
                // если был ход игрока в момент окончания раунда => проиграл
                if (player[2] == 1) {
                    outArr.push([player[0].username, player[1]]); // добавление в массив удаляемых
                    outSocket = player[0]; // сохранение сокета проигравшего
                } else {
                    inArr.push([player[0].username, player[1]]); // добавление в массив остающихся
                }
            });
        }
    });
    console.log(`round ${round} over in room ${room}`);
    // если не последний раунд и нет флага
    if (round < ROUNDS_NUBER && !lastRoundFlag) {
        // отправка события конца раунда всей комнате
        io.in(room).emit('round over', {
            in: inArr,
            out: outArr,
            total: ROUNDS_NUBER,
            last: round
        });
        setTimeout(() => {
            outSocket.leave(room); // удаление проигравшего из комнаты
            // отправка события удаления из игры проигравшему
            outSocket.emit('removal from game');
            newRound(room, round); // запуск нового раунда
        }, 10000);
    } else {
        console.log(`game over in room ${room}`);
        let winnerName;
        let color;
        // если последний раунд
        if (lastRoundFlag) {
            // победитель из массива остающихся
            winnerName = inArr[0][0]; 
            color = inArr[0][1];
        } 
        // если один игрок в комнате
        else {
            // победитель из массива удаляемых (т.к. его ход единственный)
            winnerName = outArr[0][0];
            color = outArr[0][1];
        }
        // отправка события конца игры всей комнате
        io.in(room).emit('game over', winnerName, color);
        setTimeout(() => {
            for (let i = 0; i < rooms.length; i++) {
                // доступ к данной комнате
                if (rooms[i][0] == room) {
                    rooms.splice(i, 1); // удаление комнаты из массива комнат
                    break;
                }
            }
            // отправка события удаления из игры всей комнате
            io.in(room).emit('removal from game');
        }, 10000);
    }
}

// новый раунд
async function newRound(room, lastRound) {
    console.log(`round ${lastRound + 1} started in room ${room}`);
    // обновление номера раунда
    rooms.forEach((block) => {
        if (block[0] == room) {
            block[2] = lastRound + 1;
        }
    });
    // полуение рандомного слога из массива из 100 слогов
    const syllable = syllables[utils.getRandomInt(0, syllables.length - 1)];
    // отправка события создания игрового окна в комнате
    io.in(room).emit('new round creating', syllable);
    // получение равндомного значения таймера (2-5 мин)
    const counter = utils.getRandomInt(120, 300);
    console.log(`room ${room} timer: ${counter}`);
    timer(counter, counter, room); // запуск таймера
}