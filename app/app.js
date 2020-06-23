const path = require(`path`);
const express = require(`express`);
const exphbs = require(`express-handlebars`);
const cookieParser = require('cookie-parser');
const pgp = require(`pg-promise`)();
const app = express();
const db = pgp(`postgres://nwxuyewwrvrnph:3a4212fd6b652dc571deb79b14561304ad53046d2a192861de74921130c5d95c@ec2-79-125-126-205.eu-west-1.compute.amazonaws.com:5432/d7m188e1rhggl0?ssl=true`);

app.engine(`.hbs`, exphbs({
    defaultLayout: `BasePage`,
    extname: `.hbs`,
    layoutsDir: path.join(__dirname, `/views/`)
}));

app.use(cookieParser(/*`secretCookieString`*/));
app.use(`/scripts`, express.static(__dirname + `/scripts`));
app.use(`/styles`, express.static(__dirname + `/styles`));

app.set(`view engine`, `.hbs`);
app.set(`views`, path.join(__dirname, `views/`));

app.listen(process.env.PORT || 8080);

app.get(`/bingoEdit`, (request, response) => {
    if (request.query.bingoID === undefined) {
        response.redirect(`/userpage`)
    } else {
        db.query(`select name, words from bingoschema.bingos where id = ${request.query.bingoID}`)
            .then((data) => {
                let words = data[0].words.toString();
                while (words.includes(`,`)) {
                    words = words.replace(`,`, `; `);
                }
                while (words.includes(`_`)) {
                    words = words.replace(`_`, `,`);
                }
                response.render(`bingoEdit`, {
                    pageName: `Редактировать бинго`,
                    formAction: `/userpage`,
                    buttonValue: `Отмена`,
                    render: true,
                    bingoId: request.query.bingoID,
                    bingoName: data[0].name,
                    bingoWords: words
                });
            });
    }
});

app.get(`/bingoChange`, (request, response) => {
    let words = request.query.bingoWords;
    if (words[0] === `,`) {
        words = words.substr(1, words.length - 1);
    }
    if (words[words.length - 1] === `,`) {
        words = words.substr(0, words.length - 1);
    }
    while (words.includes(`,`)) {
        words = words.replace(`,`, `_`);
    }
    while (words.includes(`;`)) {
        words = words.replace(`;`, `,`);
    }
    db.query(`update bingoschema.bingos set words = '{${words}}',
    name = '${request.query.bingoName}' where id = '${request.query.bingoId}'`)
        .then(() => {
            response.redirect(`/userpage`);
        });
});

app.get(`/deleteBingo`, (request, response) => {
    db.query(`delete from bingoschema.bingos where id = ${request.query.bingoId}`)
    response.redirect(`/userpage`)
});

app.get(`/bingoStart`, (request, response) => {
    let complete = false;
    if (request.query.bingoID === undefined) {
        response.redirect(`/userpage`)
    } else {
        db.query(`select id from bingoschema.games where id = ${request.query.bingoID}`)
            .then((data) => {
                let gameCode = Math.round(99999.5 + Math.random() * 900001);
                if (data != ``) {
                    while (!complete) {
                        for (let i = 0; i < data.length; i++) {
                            if (gameCode === data[i].id) {
                                gameCode = Math.round(99999.5 + Math.random() * 900001);
                                break;
                            }
                        }
                        complete = true;
                    }
                }
                db.query(`select id from bingoschema.bingos where id = ${request.query.bingoID}
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
                                    db.query(`insert into bingoschema.games (id, bingo_id, players) values 
                                (${gameCode}, ${bingo_id}, '{${request.cookies[`nickname`]}}')`)
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

app.get(`/gameCode`, (request, response) => {
    db.query(`select players from bingoschema.games where id = ${request.query.gameCode}`)
        .then((data) => {
            if (data == ``) {
                if (request.cookies[`loggedIn`] === `true`) {
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
                } else if (request.cookies[`nickname`] !== ``) {
                    db.query(`update bingoschema.games set players = array_append(players, 
                '${request.cookies[`nickname`]}') where id = ${request.query.gameCode}`)
                        .then(() => {
                            response.redirect(`/bingo?gameID=${request.query.gameCode}`)
                        });
                }
            }
        });
});

app.get(`/bingo`, (request, response) => {
    db.query(`select bingo_id from bingoschema.games where id = ${request.query.gameID}`)
        .then((data) => {
            if (data != ``) {
                db.query(`select name, words from bingoschema.bingos where id = ${data[0].bingo_id}`)
                    .then((data) => {
                        response.render(`game`, {
                            pageName: request.query.gameID,
                            formAction: `/bingoExit`,
                            buttonValue: `выйти из игры`,
                            render: `true`,
                            bingoWords: data[0].words,
                            bingoName: data[0].name,
                            bingoPage: true
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
            render: true
        });
    } else {
        response.redirect(`/userpage`);
    }
});

app.get(`/loginCheck`, (request, response) => {
    if (request.cookies[`loggedIn`] !== `true`) {
        db.query(`select password from bingoschema.users where nickname = '${request.query.nickname}'`)
            .then((data) => {
                if (data[0].password === request.query.password) {
                    response.cookie(`nickname`, `${request.query.nickname}`, {httpOnly: true})
                    response.cookie(`loggedIn`, true, {httpOnly: true});
                    response.redirect(`/userpage`);
                } else {
                    response.redirect(`/login`)
                }
            })
    } else {
        response.redirect(`/userpage`);
    }
});

app.get(`/`, (request, response) => {
    response.render(`main`, {
        pageName: `Главная страница`
    });
});

app.get(`/register`, (request, response) => {
    response.render(`register`, {
        pageName: `Регистрация`,
        formAction: `/`,
        buttonValue: `Отмена`,
        render: true
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
                            response.cookie(`nickname`, request.query.nickname, {HttpOnly});
                            response.cookie(`loggedIn`, true, {HttpOnly});
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

app.get(`/userpage`, (request, response) => {
    if (request.cookies[`loggedIn`] === `true`) {
        db.query(`select * from bingoschema.bingos where author = '${request.cookies[`nickname`]}' order by id`)
            .then((data) => {
                let bingos = [];
                for (let i = 0; i < data.length; i++) {
                    bingos[i] = {name: data[i].name, id: data[i].id};
                }
                db.query(`select isAdmin from bingoschema.users where nickname = '${request.cookies[`nickname`]}'`)
                    .then((data) => {
                        console.log(data)
                        response.render(`userpage`, {
                            pageName: `Мои бинго`,
                            formAction: `/exit`,
                            buttonValue: `Выйти`,
                            bingos: bingos,
                            render: true,
                            isAdmin: data[0].isadmin,
                            nickname: request.cookies[`nickname`]
                        });
                    })
                    //.catch(()=>{console.log(`here`)})
            });
    } else {
        response.redirect(`/login`);
    }
});

app.get(`/createBingo`, (request, response) => {
    db.query(`select id from bingoschema.bingos order by id`)
        .then((data) => {
            let newID = 0;
            if (data != ``) {
                for (let i = 0; i < data.length; i++) {
                    if (i < data[i].id - 1) {
                        newID = ++i;
                        break;
                    }
                }
            }
            if (newID === 0) {
                newID = data.length + 1;
            }
            db.query(`insert into bingoschema.bingos (id, author, words, name) values (${newID}, '${request.cookies[`nickname`]}', '{}', 'new ${request.cookies[`nickname`]} bingo')`)
                .then(() => {
                    response.redirect(`/bingoEdit?bingoID=${newID}`);
                })
        });
});

app.get(`/exit`, (request, response) => {
    db.query(`select id, players from bingoschema.games`)
        .then((data) => {
            if (data != ``) {
                for (let i = 0; i < data.length; i++) {
                    let newPlayers = [];
                    for (let j = 0; j < data[i].players.length; j++) {
                        if (data[i].players[j] === request.cookies[`nickname`]) {
                            response.cookie(`${data[i].id}`, ``, {maxAge: -1});
                            if (data[i].players.length === 1) {
                                db.query(`delete from bingoschema.games where id = ${data[i].id}`)
                            }
                        } else {
                            if (data[i].players[j] !== ``) {
                                newPlayers.push(data[i].players[j]);
                            }
                        }
                    }
                    if (newPlayers.length !== data[i].players.length) {
                        newPlayers = newPlayers.toString();
                        db.query(`update bingoschema.games set players='{${newPlayers}}' where id = ${data[i].id}`)
                    }
                }

            }

            response.cookie(`nickname`, ``, {maxAge: -1});
            response.cookie(`loggedIn`, ``, {maxAge: -1});
            response.redirect(`/`);
        })
});

app.get(`/bingoExit`, (request, response) => {
    db.query(`select players from bingoschema.games where id = ${request.query.gameID}`)
        .then((data) => {
            let newPlayers = [];
            for (let i = 0; i < data[0].players.length; i++) {
                if (data[0].players[i] === request.cookies[`nickname`]) {
                    if (data[0].players.length === 1) {
                        db.query(`delete from bingoschema.games where id = ${request.query.gameID}`)
                    }
                } else {
                    newPlayers.push(data[0].players[i]);
                }
            }
            if (newPlayers.length > 0) {
                newPlayers = newPlayers.toString();
                db.query(`update bingoschema.games set players='{${newPlayers}}' where id = ${request.query.gameID}`)
            }
            response.cookie(`${request.query.gameID}`, ``, {maxAge: -1});
            if (request.cookies[`loggedIn`] === `true`) {
                response.redirect(`/userpage`);
            } else {
                response.redirect(`/`);
            }
        })
});

app.get(`/iphoneapp`, (request, response) => {
    db.query(`select * from bingoschema.bingos`)
        .then((data) => {
            response.json(data)
        })
})

// app.get(`/userEdit`, (request, response) => {
//     response.render(`userEdit`, {
//         pageName: `Редактировать профиль`,
//         formAction: `/userpage`,
//         buttonValue: `Отмена`,
//         render: true
//     });
// });

// app.get(`/userEditCheck`, (request, response) => {
//     db.query(`select password from bingoschema.users where nickname='${request.cookies[`nickname`]}'`)
//         .then((data) => {
//             if (request.query.pass === data[`password`]){
//                 if (request.query.nickname != `` && request.query.newPassword != ``){
//                     db.query(`update bingoschema.users set nickname = '${request.query.nickname}' where nickname = '${request.cookies[`nickname`]}'`)
//                     db.query(`update bingoschema.users set password = '${request.query.password}' where nickname = 'request.query.nickname'`)
//                 } else if (request.query.nickname != ``) {
//                     db.query(`update bingoschema.users set nickname = '${request.query.nickname}' where nickname = '${request.cookies[`nickname`]}'`)
//                 } else if (request.query.newPassword != ``){
//                     db.query(`update bingoschema.users set password = '${request.query.password}' where nickname = '${request.cookies[`nickname`]}'`)
//                 }
//             }
//             response.redirect(`/userEdit`)
//         })
// });
//
// // app.get(`/admin`, (request, response) => {
// //     db.query(`select isadmin from bingoschema.users where nickname = '${request.cookies[`nickname`]}'`)
// //         .then((data) => {
// //             if (!data[0].isadmin) {
// //                 response.redirect(`/userpage`);
// //             } else {
// //                 response.render(`adminPage`, {
// //                     pageName: `Администрирование`,
// //                     formAction: `/userpage`,
// //                     buttonValue: `Вернуться`,
// //                     render: true
// //                 });
// //             }
// //         });
// // });
//
// app.get(`/users`, (request, response) => {
//     db.query(`select isadmin from bingoschema.users where nickname = '${request.cookies[`nickname`]}'`)
//         .then((data) => {
//             if (!data[0].isadmin) {
//                 response.redirect(`/userpage`);
//             } else {
//                 let users = [];
//                 db.query(`select nickname, isadmin, isbanned from bingoschema.users`)
//                     .then((userData) => {
//                         for (let i = 0; i < userData.length; i++) {
//                             users[i] = {
//                                 nickname: userData[i].nickname,
//                                 isAdmin: userData[i].isadmin,
//                                 isbanned: userData[i].isbanned
//                             };
//                         }
//                         response.render(`users`, {
//                             pageName: `Пользователи`,
//                             formAction: `/userpage`,
//                             buttonValue: `Вернуться`,
//                             users: users,
//                             render: true
//                         });
//                     })
//             }
//         })
// })
//
// app.get(`/bingos`, (request, response) => {
//     db.query(`select isadmin from bingoschema.users where nickname = '${request.cookies[`nickname`]}'`)
//         .then((data) => {
//             if (!data[0].isadmin) {
//                 response.redirect(`/userpage`);
//             } else {
//                 db.query(`select * from bingoschema.bingos order by id`)
//                     .then((bingoData) => {
//                         let bingos = [];
//                         for (let i = 0; i < bingoData.length; i++) {
//                             let words = bingoData[i].words.toString()
//                             while (words.includes(`,`)){
//                                 words = words.replace(`,`, `; `);
//                             }
//                             while (words.includes(`_`)){
//                                 words = words.replace(`_`, `,`);
//                             }
//                             bingos[i] = {
//                                 name: bingoData[i].name,
//                                 id: bingoData[i].id,
//                                 words: words,
//                                 author: bingoData[i].author
//                             };
//                         }
//                         // console.log(bingos)
//                         response.render(`bingos`, {
//                             pageName: `Бинго пользователей`,
//                             formAction: `/userpage`,
//                             buttonValue: `Вернуться`,
//                             bingos: bingos,
//                             render: true
//                         });
//                     })
//             }
//         })
// })
//
// app.get(`/games`, (request, response) => {
//     db.query(`select isadmin from bingoschema.users where nickname = '${request.cookies[`nickname`]}'`)
//         .then((data) => {
//             if (!data[0].isadmin) {
//                 response.redirect(`/userpage`);
//             } else {
//                 db.query(`select * from bingoschema.games order by id`)
//                     .then((gamesData) => {
//                         let games = [];
//                         for (let i = 0; i < gamesData.length; i++) {
//                             games[i] = {
//                                 code: gamesData[i].id,
//                                 bingo: gamesData[i].bingo_id,
//                                 players: gamesData[i].players
//                             };
//
//                         }
//                         response.render(`games`, {
//                             pageName: `Запущенные игры`,
//                             formAction: `/userpage`,
//                             buttonValue: `Вернуться`,
//                             games: games,
//                             render: true
//                         });
//                     })
//             }
//         })
// })
//
// app.get(`/changeAdminStatus`, (request, response) => {
//     response.redirect(`/users`)
//     db.query(`select isadmin from bingoschema.users where nickname = '${request.cookies[`nickname`]}' or nickname = '${request.query.nickname}'`)
//         .then((data) => {
//             console.log(`query: ${request.query.nickname}`)
//             console.log(`data: ${data[0].isadmin}`)
//             if (request.cookies[`loggedIn`] !== `true`){
//                 response.redirect(`/`)
//             } else if (data[0].isadmin !== `true`){
//                 response.redirect(`/userpage`)
//             } else {
//                 db.query(`update bingoschema.users set `)
//             }
//         })
// })