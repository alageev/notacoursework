const colors = [
    `#0a84ff`, //blue
    `#30d158`, //green
    `#5e5ce6`, //indigo
    `#ff9f0a`, //orange
    `#ff375f`, //pink
    `#bf5af2`, //purple
    `#ff453a`, //red
    `#64d2ff`, //teal
    `#ffd60a`  //yellow
];

let marked = Array(25);
let cookies = document.cookie.split(`;`);
let seed = ``;
console.log(cookies)
for (let cookie of cookies){
    if (cookie.substr(0, 6) === cookieName){
        seed = cookie.substr(7);
        break;
    } else {
        seed = ``;
    }
}

window.onload = () => {
    colorCheck();
};

if (seed === ``){
    generateBingo();
} else {
    newBingo(seed);
}

for (let i = 0; i < 25; i++){
    document.getElementById(`td${i}`).style.background = ``;
}

function randomColor(code = Math.round(-0.5 + Math.random() * 9)){
    return colors[code % 9];
}

function generateBingo(){
    let used = Array(phrases.length);
    for (let i = 0; i < phrases.length; i++){
        used[i] = false;
    }
    seed = ``;
    for (let i = 0; i < 5; i++){
        for (let j = 0; j < 5; j++){
            let code = Math.round(-0.5 + Math.random() * phrases.length);
            while (used[code]){
                code = Math.round(-0.5 + Math.random() * phrases.length);
            }
            used[code] = true;
            document.getElementById(`td${5 * i + j}`).innerText = phrases[code];
            document.getElementById(`td${5 * i + j}`).style.background = ``;
            document.getElementById(`td${5 * i + j}`).style.color = `#000000`;
            seed += `${to62(code)}`;
        }
    }
    seed += `00000`;
    document.cookie = `${cookieName}=${seed}`;
}

function newBingo(newSeed){
    let colorCode;
    for (let i = 0; i < 25; i++){
        if (i % 5 === 0){
            colorCode = to10(newSeed.substr(25 + Math.floor(i / 5), 1));
        }
        document.getElementById(`td${i}`).innerText = phrases[to10(newSeed.substr(i, 1))].replace(`_`,` `).replace(`;`,`,`);
        if (colorCode % 2 === 1){
            document.getElementById(`td${i}`).style.color = `#f0f0f0`;
            document.getElementById(`td${i}`).style.background = colors[Math.round(-0.5 + Math.random() * 9)];
            marked[i] = true
        } else {
            document.getElementById(`td${i}`).style.background = ``;
            document.getElementById(`td${i}`).style.color = `#000000`;
            marked[i] = false
        }
        colorCode = Math.floor(colorCode / 2);
    }
    markedToSeed();
}

function colorCheck(){
    for (let i = 0; i < 25; i++){
        if (marked[i]){
            document.getElementById(`td${i}`).style.color = `#ffffff`;
            document.getElementById(`td${i}`).style.background = randomColor();
        }
    }
}

function updateBingo(i){
    marked[i] = !marked[i];
    if (document.getElementById(`td${i}`).style.background === ``){
        document.getElementById(`td${i}`).style.background = randomColor();
        document.getElementById(`td${i}`).style.color = `#ffffff`;
    } else {
        document.getElementById(`td${i}`).style.background = ``;
        document.getElementById(`td${i}`).style.color = `#000000`;
    }
    if (
        marked[Math.floor(i / 5) * 5] &&
        marked[Math.floor(i / 5) * 5 + 1] &&
        marked[Math.floor(i / 5) * 5 + 2] &&
        marked[Math.floor(i / 5) * 5 + 3] &&
        marked[Math.floor(i / 5) * 5 + 4] ||
        marked[i % 5] &&
        marked[i % 5 + 5] &&
        marked[i % 5 + 10] &&
        marked[i % 5 + 15] &&
        marked[i % 5 + 20] ||
        i % 5 === Math.floor(i / 5) &&
        marked[0] &&
        marked[6] &&
        marked[12] &&
        marked[18] &&
        marked[24] ||
        i % 5 === 4 - Math.floor(i / 5) &&
        marked[4] &&
        marked[8] &&
        marked[12] &&
        marked[16] &&
        marked[20]
    ){

        alert(`BINGO!`);
    }
    markedToSeed();
}



function to62(number){
    switch (true){
        case number < 10:
            return number;
        case 9 < number && number < 36:
            return String.fromCodePoint(87 + number);
        case 35 < number :
            return String.fromCodePoint(29 + number);
    }
}

function to10(number){
    switch (true){
        case code(number) <= code(`9`):
            return code(number) - code(`0`);
        case code(`a`) <= code(number) && code(number) <= code(`z`):
            return code(number) - code(`a`) + 10;
        case code(`A`) <= code(number) && code(number) <= code(`Z`):
            return code(number) - code(`A`) + 36;
    }
}

function code(number){
    return String(number).charCodeAt(0);
}

function markedToSeed(){
    seed = seed.substr(0, 25);
    for (let i = 0; i < 5; i++){
        let result = 0;
        for (let j = 0; j < 5; j++){
            if (marked[5 * i + j]){
                result += Math.pow(2, j);
            }
        }
        seed += to62(result);
    }
    document.cookie = `${cookieName}=${seed}`;
}

