import servgen from '@abskmj/servgen';
import EventEmitter from 'events';
import debug from "debug";

const log = debug("app:module:effects");

export default async (app) => {
    const effect = new EventEmitter();

    effect.lightning = app.lightning;

    try {
        await servgen.init(effect, `${__dirname}/../effects`);
    } catch (error) {
        log(error);
    }

    app.on('cli-effect', (effect) => {
        app.effect(effect)
    });

    return effect
}