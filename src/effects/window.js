import KEY from '../objects/keys';
import debug from 'debug';

const log = debug("app:effect:window");

let current = "";

export default (app, name) => {
    // if (!app.config.effects.window.enabled) return;

    const program = Programs[name];

    if (program && current !== program.name) {
        app.disableEffect();
        app.setEffectFlag(true);

        if (program.color) {
            app.color(program.color[0], program.color[1], program.color[2], { hue_bright: true });
        } else if (program.effect === "readCorsair") {
            readCorsair(app);
        }

        current = program.name;

        log(`Changed color according to ${program.name}`);
    }
};

function readCorsair (app) {
    const led = app.cue._getLedColor(KEY.W);

    log(led);
}

const Programs = {
    // "Code.exe": {
    //     name: "VSCode",
    //     color: [ 0, 75, 255 ]
    // },
    // "Adobe Premiere Pro.exe": {
    //     name: "Premiere Pro",
    //     color: [ 255, 0, 255 ]
    // },
    // "Photoshop.exe": {
    //     name: "Photoshop",
    //     color: [ 0, 20, 255 ]
    // },
    // "Adobe Audition CC.exe": {
    //     name: "Audition",
    //     color: [ 0, 255, 75 ]
    // },
    // "Illustrator.exe": {
    //     name: "Illustrator",
    //     color: [ 255, 175, 0 ]
    // },
    // "Adobe XD CC": {
    //     name: "Experience Design",
    //     color: [ 255, 50, 255 ]
    // },
    "FarCry5.exe": {
        name: "Far Cry 5",
        effect: "readCorsair"
    }
}