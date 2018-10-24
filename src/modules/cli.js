import inquirer from 'inquirer';
import chalk from 'chalk';
import debug from "debug";

const log = debug("app:module:cli");

export default (app) => {
    const query = {
        input (message, cb) {
            inquirer.prompt({
                type: 'input',
                name: 'value',
                message
            }).then(answers => {
                cb(answers.value)
            });
        },
        confirm (message, cb) {
            inquirer.prompt({
                type: 'confirm',
                name: 'value',
                message
            }).then(answers => {
                cb(answers.value)
            });
        },
    }

    process.stdin.on('data', (data) => {
        log(data[0])
        log(data[1])

        if (data[0] === 5 && data[1] === 13) {
            effectsMenu();
        }
    });

    function effectsMenu() {
        inquirer.prompt([
            {
                type: "list",
                name: "value",
                message: "Select an Option (Effect Menu)",
                choices: [
                    {
                        name: "Sync with Screen",
                        value: 'sync_screen'
                    },
                    {
                        name: "Sync with Audio",
                        value: 'sync_music'
                    },
                    {
                        name: "Rainbow Effect",
                        value: "effect_rainbow"
                    },
                    {
                        name: "Gradient Effect",
                        value: "effect_gradient"
                    },
                    {
                        name: "Wave Effect",
                        value: "effect_wave"
                    },
                    {
                        name: "Walk Effect",
                        value: "effect_walk"
                    },
                    {
                        name: "Fire Effect",
                        value: "effect_fire"
                    },
                    {
                        name: "Water Effect",
                        value: "effect_water"
                    },
                    {
                        name: "Random Fill Effect",
                        value: "effect_random"
                    },
                    {
                        name: "Static: Off",
                        value: "static_off"
                    },
                    {
                        name: "Static: Red",
                        value: "static_red"
                    },
                    {
                        name: "Static: Green",
                        value: "static_green"
                    },
                    {
                        name: "Static: Blue",
                        value: "static_blue"
                    },
                    {
                        name: "Static: White",
                        value: "static_white"
                    }
                ]
            }
        ])
        .then(answers => {
            app.emit('cli-effect', answers.value);
            process.stdin.resume();
            console.log("\n")
        });
    }

    return {
        query,
        chalk,
        print: console.log
    }
}