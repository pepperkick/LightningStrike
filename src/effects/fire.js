const OldSet = [], NewSet = [];
const step = 1;

let flag = false, oldSetFlag = false, newSetFlag = false;

export default (app) => {
    if (app.lightning.length === 0) {
        for (let i = 0; i < 3000; i++) {
            app.lightning[i] = [255, 0, 0];
        }
    }

    if (!newSetFlag) {
        generateNewSet(app);
    }

    flag = true;

    for (let i = 0; i < app.lightning.length; i++) {
        if (app.lightning[i][0] !== NewSet[i][0]) { flag = false; if (app.lightning[i][0] < NewSet[i][0]) app.lightning[i][0]++; else app.lightning[i][0]--; }
        if (app.lightning[i][1] !== NewSet[i][1]) { flag = false; if (app.lightning[i][1] < NewSet[i][1]) app.lightning[i][1]++; else app.lightning[i][1]--; }
        if (app.lightning[i][2] !== NewSet[i][2]) { flag = false; if (app.lightning[i][2] < NewSet[i][2]) app.lightning[i][2]++; else app.lightning[i][2]--; }
    }

    if (flag) {
        newSetFlag = false;
    }

    return app.lightning;
}

function setOldSet(app) {
    for (let i = 0; i < app.lightning.length; i++) {
        OldSet[i] = app.lightning[i];
    }

    oldSetFlag = true;
}

function generateNewSet(app) {
    for (let i = 0; i < app.lightning.length; i++) {
        NewSet[i] = [255, parseInt(Math.random() * 125), 0]
    }

    newSetFlag = true;
}