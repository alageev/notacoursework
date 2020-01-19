const path = require(`path`);
const express = require(`express`);
const exphbs = require(`express-handlebars`);
const cookieParser = require('cookie-parser');
const pgp = require(`pg-promise`)();
const app = express();
const db = pgp(`postgres://nwxuyewwrvrnph:3a4212fd6b652dc571deb79b14561304ad53046d2a192861de74921130c5d95c@ec2-79-125-126-205.eu-west-1.compute.amazonaws.com:5432/d7m188e1rhggl0`);
//const db = pgp("postgres://postgres:1@127.0.0.1:5432/bingodatabase");

app.engine(`.hbs`, exphbs({
    defaultLayout: `BasePage`,
    extname: `.hbs`,
    layoutsDir: path.join(__dirname, `/views/`)
}));

app.use(cookieParser());
app.use(`/scripts`, express.static(__dirname + `/scripts`));
app.use(`/styles`, express.static(__dirname + `/styles`));

app.set(`view engine`, `.hbs`);
app.set(`views`, path.join(__dirname, `views/layouts`));

app.listen(process.env.PORT || 8080);

app.get(`/bingoEdit`, (request, response) => {
    if (request.query.bingoName === undefined){
        response.redirect(`/userpage`)
    } else {
        db.query(`select id, name, words from bingoschema.bingos where name = '${request.query.bingoName}'`)
            .then((data) => {
                response.render(`bingoEdit`, {
                    pageName: `Редактировать бинго`,
                    formAction: `/userpage`,
                    buttonValue: `Отмена`,
                    render: true,
                    bingoId: data[0].id,
                    bingoName: data[0].name,
                    bingoWords: data[0].words
                });
            });
    }
});

app.get(`/bingoChange`, (request, response) => {
    db.query(`update bingoschema.bingos set words = '{${request.query.bingoWords}}',
    name = '${request.query.bingoName}' where id = '${request.query.bingoId}'`)
        .then(() => {
            response.redirect(`/userpage`);
        });
});

app.get(`/bingoStart`, (request, response) => {
    let complete = false;
    if (request.query.bingoName === undefined){
        response.redirect(`/userpage`)
    } else {
        db.query(`select id from bingoschema.games`)
            .then((data) => {
                let gameCode = Math.round(99999.5 + Math.random() * 999999);
                if (data != ``) {
                    while (!complete) {
                        for (let i = 0; i < data.length; i++) {
                            if (gameCode === data[i].id) {
                                gameCode = Math.round(99999.5 + Math.random() * 999999);
                                break;
                            }
                        }
                        complete = true;
                    }
                }
                db.query(`select id from bingoschema.bingos where name = '${request.query.bingoName}' 
            and author = '${request.cookies[`nickname`]}'`)
                    .then((data) => {
                        let bingo_id = data[0].id;
                        db.query(`select id, players from bingoschema.games where bingo_id = ${data[0].id}`)
                            .then((data) => {
                                let isGame = false;
                                let previousGameCode;
                                if (data != ``) {
                                    for (let i = 0; i < data[0].players.length; i++) {
                                        if (data[0].players[i] === request.cookies[`nickname`]) {
                                            isGame = true;
                                            previousGameCode = data[0].id;
                                        }
                                    }
                                }
                                if (!isGame) {
                                    db.query(`insert into bingoschema.games (id, players, bingo_id) values 
                                ('${gameCode}', '{${request.cookies[`nickname`]}}', ${bingo_id})`)
                                        .then(() => {
                                            response.redirect(`/bingo?gameID=${gameCode}`);
                                        })
                                } else {
                                    response.redirect(`/bingo?gameID=${previousGameCode}`);
                                }
                            });
                    });
            });
    }
});

app.get(`/tempLogin`, (request, response) => {
    response.render(`tempLogin`, {
        pageName: `Временный вход`,
        formAction: `/`,
        buttonValue: `Отмена`,
        render: true,
        gameCode: request.query.gameCode
    });
});

app.get(`/tempLoginCheck`, (request, response) => {
    db.query(`select nickname from bingoschema.users`)
        .then((data) => {
            let nicknameIsUsed = false;
            for (let nickname of data[0].nickname) {
                if (nickname === request.query.nickname) {
                    nicknameIsUsed = true;
                }
            }
            if (!nicknameIsUsed) {
                response.cookie(`nickname`, request.query.nickname);
                response.cookie(`loggedIn`, true);
                response.redirect(`/gameCode?gameCode=${request.query.gameCode}`);
            } else {
                response.redirect(`/tempLogin?gameCode=${request.query.gameCode}`);
            }
        });
});

app.get(`/gameCode`, (request, response) => {
    db.query(`select players from bingoschema.games where id = '${request.query.gameCode}'`)
        .then((data) => {
            if (data == ``){
                if (request.cookies[`loggedIn`] === `true`){
                    response.redirect(`/userpage`)
                } else {
                    response.redirect(`/`)
                }
            } else {
                let isPlaying = false;
                for (let player of data[0].players) {
                    if (player === request.cookies[`nickname`]) {
                        isPlaying = true;
                        break;
                    }
                }
                if (isPlaying) {
                    response.redirect(`/bingo?gameID=${request.query.gameCode}`);
                } else {
                    db.query(`update bingoschema.games set players = array_append(players, 
                '${request.cookies[`nickname`]}') where id = '${request.query.gameCode}'`)
                        .then(() => {
                            response.redirect(`/bingo?gameID=${request.query.gameCode}`)
                        });
                }
            }
        });
});

app.get(`/bingo`, (request, response) => {
    db.query(`select bingo_id from bingoschema.games where id = '${request.query.gameID}'`)
        .then((data) => {
            if (data != ``) {
                db.query(`select name, words from bingoschema.bingos where id = ${data[0].bingo_id}`)
                    .then((data) => {
                        response.render(`game`, {
                            pageName: request.query.gameID,
                            formAction: `/bingoExit?gameID=${request.query.gameID}`,
                            buttonValue: `выйти из игры`,
                            render: `true`,
                            bingoWords: data[0].words,
                            bingoName: data[0].name
                        });
                    });
            } else {
                response.redirect(`/login`)
            }
        });
});

app.get(`/login`, (request, response) => {
    if (request.cookies[`loggedIn`] !== `true`) {
        response.render(`login`, {
            pageName: `Вход`,
            formAction: `/`,
            buttonValue: `Отмена`,
            render: true,
        });
    } else {
        response.redirect(`/userpage`);
    }
});

app.get(`/loginCheck`, (request, response) => {
    if (request.cookies[`loggedIn`] !== `true`) {
        db.query(`select password from bingoschema.users where nickname = '${request.query.nickname}'`)
            .then((data) => {
                if (data == ``) {
                    response.redirect(`/login`);
                }
                if (data[0].password === request.query.password) {
                    response.cookie(`nickname`, `${request.query.nickname}`)
                    response.cookie(`loggedIn`, true);
                    response.redirect(`/userpage`);
                } else {}
                response.redirect(`/login`)
            })
    } else {
        response.redirect(`/userpage`);
    }
});

app.get(`/`, (request, response) => {
    if (request.cookies[`loggedIn`] !== `true`) {
        response.cookie(`nickname`, ``);
        response.cookie(`loggedIn`, false);
    }
    response.render(`main`, {
        pageName: `Главная страница`,
        formAction: ``,
        buttonValue: ``,
        render: false,
    });
});

app.get(`/register`, (request, response) => {
    response.render(`register`, {
        pageName: `Регистрация`,
        formAction: `/`,
        buttonValue: `Отмена`,
        render: true,
    });
});

app.get(`/registrationCheck`, (request, response) => {
    db.query(`select * from bingoschema.users where nickname ='${request.query.nickname}'`)
        .then((data) => {
            if (data == ``) {
                if (request.query.pass1 === request.query.pass2) {
                    db.query(`insert into bingoschema.users (nickname, password) values 
                    ('${request.query.nickname}', '${request.query.pass1}')`)
                        .then(() => {
                            response.cookie(`nickname`, request.query.nickname);
                            response.cookie(`loggedIn`, true);
                            response.redirect(`/userpage`);
                        });
                } else {
                    response.redirect(`/register`);
                }
            } else {
                response.redirect(`/login`);
            }
        });
});

app.get(`/userEdit`, (request, response) => {
    response.render(`userEdit`, {
        pageName: `Редактировать профиль`,
        formAction: `/userpage`,
        buttonValue: `Отмена`,
        render: true,
    });
});

app.get(`/userpage`, (request, response) => {
    if (request.cookies[`loggedIn`] === `true`) {
        db.query(`select * from bingoschema.bingos where author = '${request.cookies[`nickname`]}'`)
            .then((data) => {
                let bingoNames = [];
                for (let i = 0; i < data.length; i++) {
                    bingoNames[i] = data[i].name;
                }
                response.render(`userpage`, {
                    pageName: `Мои бинго`,
                    formAction: `/exit`,
                    buttonValue: `Выйти`,
                    bingos: bingoNames,
                    render: true,
                });
            });
    } else {
        response.redirect(`/login`);
    }
});


app.get(`/createBingo`, (request, response) => {
    db.query(`select max(id) from bingoschema.bingos`)
        .then((data) => {
            if (data == ``) {
                db.query(`insert into bingoschema.bingos (id, author, words, name) values 
                (1, '${request.cookies[`nickname`]}', '{}', 'new_${request.cookies[`nickname`]}_bingo')`);
            } else {
                db.query(`insert into bingoschema.bingos (id, author, words, name) values 
                (${data[0].max + 1}, '${request.cookies[`nickname`]}', '{}', 'new_${request.cookies[`nickname`]}_bingo')`);
            }
            response.redirect(`/bingoEdit?bingoName=new_${request.cookies[`nickname`]}_bingo`);
        });
});

app.get(`/exit`, (request, response) => {
    db.query(`select id, players from bingoschema.games`)
        .then((data) => {
            if (data != ``) {
                for (let i = 0; i < data.length; i++) {
                    for (let j = 0; j < data[i].players.length; j++) {
                        let newPlayers = [];
                        if (data[i].players[j] === request.cookies[`nickname`]) {
                            if (data[i].players[j].length === 1) {
                                db.query(`delete * from bingoschema.games where id = ${data[i].id}`);
                            } else {
                                for (let k = 0; k < data[i].players.length; k++) {
                                    if (k !== j) {
                                        newPlayers.push(data[i].players[k]);
                                    }
                                }
                                newPlayers = newPlayers.toString();
                                newPlayers = newPlayers.substr(1, newPlayers.length - 2);
                                db.query(`update set players='{${newPlayers}}' from bingoschema.games where id = ${data[i].id}`)
                            }
                        }
                    }
                }
            }
            response.cookie(`nickname`, ``);
            response.cookie(`loggedIn`, false);
            response.redirect(`/`);
        })
});
app.get(`/bingoExit`, (request, response) => {
    db.query(`select id, players from bingoschema.games`)
        .then((data) => {
            if (data != ``) {
                for (let i = 0; i < data.length; i++) {
                    for (let j = 0; j < data[i].players.length; j++) {
                        let newPlayers = [];
                        if (data[i].players[j] === request.cookies[`nickname`]) {
                            if (data[i].players[j].length === 1) {
                                db.query(`delete * from bingoschema.games where id = ${data[i].id}`);
                            } else {
                                for (let k = 0; k < data[i].players.length; k++) {
                                    if (k !== j) {
                                        newPlayers.push(data[i].players[k]);
                                    }
                                }
                                newPlayers = newPlayers.toString();
                                newPlayers = newPlayers.substr(1, newPlayers.length - 2);
                                db.query(`update set players='{${newPlayers}}' from bingoschema.games where id = ${data[i].id}`)
                            }
                        }
                    }
                }
            }
            if (request.cookies[`loggedId`] === `true`){
                response.redirect(`/userpage`);
            } else {
                response.redirect(`/`);
            }
        })
});