const path = require(`path`);
const express = require(`express`);
const exphbs = require(`express-handlebars`);
const session = require(`express-session`);
const pgp = require(`pg-promise`)();
//const pg = require(`pg`);
const app = express();
const db = pgp(`postgres://nwxuyewwrvrnph:3a4212fd6b652dc571deb79b14561304ad53046d2a192861de74921130c5d95c@ec2-79-125-126-205.eu-west-1.compute.amazonaws.com:5432/d7m188e1rhggl0`);

db.query(`alter table bingoschema.users drop column nickname`).then(() =>{
    db.query(`alter table bingoschema.users
add nickname varchar not null;

create unique index users_nickname_uindex
on bingoschema.users (nickname);

alter table bingoschema.users
add constraint users_pk
primary key (nickname);
`)
}).then(()=>{



app.use(session({
    secret: `secretWord`,   // секретное слово для шифрования
    key: `bingoSession`,             // имя куки
    cookie: {
        path: `/*`,          // где действует
        httpOnly: true,     // чтобы куку не могли читать на клиенте
        maxAge: null        // время жизни куки
    },
    loggedIn: false,
    nickname: ``,
    seed: ``,
    saveUninitialized: false,   // on default
    resave: false               // on  default
}));


const isLoggedIn = (request, response, next) => {
    db.query(`select password from bingoschema.users where nickname = '${request.query.nickname}'`)
        .then((data) => {
            if (!session.loggedIn) {
                if (`${request.query.password}` === data[0].password) {
                    session.loggedIn = true;
                    session.nickname = `${request.query.nickname}`
                }
            }
            return next()
        })
        .catch(() => {
            response.redirect(`/`)
        });
};

app.engine(`.hbs`, exphbs({
    defaultLayout: `BasePage`,
    extname: `.hbs`,
    layoutsDir: path.join(__dirname, `/views/`)

}));

app.use(`/scripts`, express.static(__dirname + `/scripts`));
app.use(`/styles`, express.static(__dirname + `/styles`));

app.set(`view engine`, `.hbs`);
app.set(`views`, path.join(__dirname, `views/layouts`));
app.listen(process.env.PORT || 8080);

app.get(`/bingoEdit`, isLoggedIn, (request, response) => {
    db.query(`select id, name, words from bingoschema.bingos where name = '${request.query.bingoName}'`)
        .then((data) => {
            response.render(`bingoEdit`, {
                pageName: `Редактировать бинго`,
                bingoId: data[0].id,
                bingoName: data[0].name,
                bingoWords: data[0].words
            });
        });
});

app.get(`/bingoChange`, isLoggedIn, (request, response) => {
    db.query(`update bingoschema.bingos set words = '{${request.query.bingoWords}}', name = '${request.query.bingoName}' where id = '${request.query.bingoId}'`)
        .then(() => {
            response.redirect(`/userpage`);
        });
});

app.get(`/bingoStart`, isLoggedIn, (request, response) => {
    let complete = false;
    db.query(`select id from bingoschema.games`)
        .then((data) => {
            let gameCode = Math.round(99999.5 + Math.random() * 999999);
            if (data != ``) {
                while (!complete) {
                    for (let code of data[0].id) {
                        if (gameCode === code) {
                            gameCode = Math.round(99999.5 + Math.random() * 999999);
                            break;
                        }
                    }
                    complete = true;
                }
            }
            db.query(`select id from bingoschema.bingos where name = '${request.query.bingoName}' and author = '${session.nickname}'`)
                .then((data) => {
                    let bingo_id = data[0].id;
                    db.query(`select id, players from bingoschema.games where bingo_id = ${data[0].id}`)
                        .then((data) => {
                            let isGame = false;
                            let previousGameCode;
                            if (data != ``) {
                                for (let i = 0; i < data[0].players.length; i++) {
                                    if (data[0].players[i] === session.nickname) {
                                        isGame = true;
                                        previousGameCode = data[0].id;
                                    }
                                }
                            }
                            if (!isGame) {
                                db.query(`insert into bingoschema.games (id, players, bingo_id) values ('${gameCode}', '{${session.nickname}}', ${bingo_id})`)
                                    .then(() => {
                                        response.redirect(`/bingo?gameID=${gameCode}`);
                                    })
                            } else {
                                response.redirect(`/bingo?gameID=${previousGameCode}`);
                            }
                        });
                });
        });
});

app.get(`/tempLogin`, (request, response) => {
    response.render(`tempLogin`, {
        pageName: `Временный вход`,
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
                session.nickname = request.query.nickname;
                session.loggedIn = true;
                response.redirect(`/gameCode?gameCode=${request.query.gameCode}`);
            } else {
                response.redirect(`/tempLogin?gameCode=${request.query.gameCode}`);
            }
        });
});

app.get(`/gameCode`, (request, response) => {
    if (!session.loggedIn) {
        response.redirect(`/tempLogin?gameCode=${request.query.gameCode}`);
    } else {
        db.query(`select players from bingoschema.games where id = '${request.query.gameCode}'`)
            .then((data) => {
                let isPlaying = false;
                for (let player of data[0].players) {
                    if (player === session.nickname) {
                        isPlaying = true;
                        break;
                    }
                }
                if (isPlaying) {
                    response.redirect(`/bingo?gameID=${request.query.gameCode}`);
                } else {
                    db.query(`update bingoschema.games set players = array_append(players, '${session.nickname}') where id = '${request.query.gameCode}'`)
                        .then(() => {
                            response.redirect(`/bingo?gameID=${request.query.gameCode}`)
                        });
                }
            });
    }
});

app.get(`/bingo`, isLoggedIn, (request, response) => {
    db.query(`select bingo_id from bingoschema.games where id = '${request.query.gameID}'`)
        .then((data) => {
            db.query(`select name, words from bingoschema.bingos where id = ${data[0].bingo_id}`)
                .then((data) => {
                    response.render(`game`, {
                        pageName: request.query.code,
                        bingoWords: data[0].words,
                        bingoName: data[0].name
                    });
                });
        });
});

app.get(`/login`, (request, response) => {
    if (!session.loggedIn) {
        response.render(`login`, {
            pageName: `Вход`
        });
    } else {
        response.redirect(`/userpage`);
    }
});

app.get(`/loginCheck`, isLoggedIn, (request, response) => {
    response.redirect(`/userpage`);
});

app.get(`/`, (request, response) => {
    response.render(`main`, {
        pageName: `Главная страница`
    });
});

app.get(`/register`, (request, response) => {
    response.render(`register`, {
        pageName: `Регистрация`,
    });
});

app.get(`/registrationCheck`, (request, response) => {
    db.query(`select * from bingoschema.users where nickname ='${request.query.nickname}'`)
        .then((data) => {
            if (data == ``) {
                if (request.query.pass1 === request.query.pass2) {
                    db.query(`insert into bingoschema.users (nickname, password) values ('${request.query.nickname}', '${request.query.pass1}')`)
                        .then(() => {
                            session.nickname = request.query.nickname;
                            session.loggedIn = true;
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

app.get(`/userEdit`, isLoggedIn, (request, response) => {
    response.render(`userEdit`, {
        pageName: `Редактировать профиль`,
    });
});

app.get(`/userpage`, isLoggedIn, (request, response) => {
    if (session.loggedIn) {
        db.query(`select * from bingoschema.bingos where author = '${session.nickname}'`)
            .then((data) => {
                let bingoNames = [];
                for (let i = 0; i < data.length; i++) {
                    bingoNames[i] = data[i].name;
                }
                response.render(`userpage`, {
                    pageName: `Мои бинго`,
                    bingos: bingoNames
                });
            });
    } else {
        response.redirect(`/`);
    }
});


app.get(`/createBingo`, isLoggedIn, (request, response) => {
    db.query(`select max(id) from bingoschema.bingos`)
        .then((data) => {
            db.query(`insert into bingoschema.bingos (id, author, words, name) values (${data[0].max + 1}, '${session.nickname}', '{}', 'new_${session.nickname}'s_bingo')`);
            response.redirect(`/bingoEdit?bingoName=new_${session.nickname}'s_bingo`);
        });
});

app.use((err, request, response) => {
    // логирование ошибки, пока просто console.log
    console.log(err);
    response.status(500).send(`Something broke!`)
});

})