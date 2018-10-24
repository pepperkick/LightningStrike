import KEY from '../objects/keys';
import debug from 'debug';

const log = debug("app:effect:gradient");

export default (app) => {
    if (app.lightning.length === 0) {
        for (let i = 0; i < 3000; i++) {
            app.lightning[i] = [0, 0, 0];
        }
    }

    const color2 = [ 255,   0, 225 ];
    const color1 = [   0, 160, 255 ];
    const diff = [
        subtract(color1[0], color2[0]),
        subtract(color1[1], color2[1]),
        subtract(color1[2], color2[2])
    ];

    for (let i = 0; i < sections.length; i++) {
        const percentage = percentages[i];
        const color = [
            parseInt(color1[0] - ( ( diff[0] / 100 ) * percentage )),
            parseInt(color1[1] - ( ( diff[1] / 100 ) * percentage )),
            parseInt(color1[2] - ( ( diff[2] / 100 ) * percentage )),
        ]

        const section = sections[i];

        for (let j = 0; j < section.length; j++) {
            app.lightning[section[j]] = color;
        } 
    }

    return app.lightning;
};

const percentages = [ 0, 0, 0, 0, 0, 0, 0, 0, 0, 25, 38, 50, 62, 75, 100, 100, 100, 100, 100, 100, 100, 100, 100]

const sections = [
    [ KEY.HUE_1, KEY.AURA, KEY.BAR_1, KEY.G1, KEY.G2, KEY.G3, KEY.G4, KEY.G5, KEY.G6, KEY.NZXT_1_1, KEY.NZXT_1_20, KEY.NZXT_2_20 ],
    [ KEY.LEFT_CTRL, KEY.LEFT_SHIFT, KEY.CAPS_LOCK, KEY.TAB, KEY.TILDE, KEY.ESCAPE, KEY.BAR_2, KEY.NZXT_2_19 ],
    [ KEY.LEFT_WIN, KEY.Z, KEY.A, KEY.Q, KEY.ONE, KEY.F1, KEY.LED_PROFILE, KEY.BAR_3, KEY.INVALID, KEY.NZXT_1_2, KEY.NZXT_1_19, KEY.NZXT_2_18 ],
    [ KEY.LEFT_ALT, KEY.X, KEY.S, KEY.W, KEY.TWO, KEY.F2, KEY.LED_BRIGHTNESS, KEY.BAR_4, KEY.NZXT_2_17 ],
    [ KEY.INVALID, KEY.C, KEY.D, KEY.E, KEY.THREE, KEY.F3, KEY.WIN_LOCK, KEY.BAR_5, KEY.NZXT_1_3, KEY.NZXT_1_18, KEY.NZXT_2_16 ],
    [ KEY.INVALID, KEY.V, KEY.F, KEY.R, KEY.FOUR, KEY.F4, KEY.BAR_6, KEY.NZXT_2_15 ],
    [ KEY.SPACE, KEY.B, KEY.G, KEY.T, KEY.FIVE, KEY.NZXT_2_14 ],
    [ KEY.N, KEY.H, KEY.Y, KEY.SIX, KEY.F5, KEY.NZXT_1_4, KEY.NZXT_1_17, KEY.NZXT_2_13 ],
    [ KEY.M, KEY.J, KEY.U, KEY.SEVEN, KEY.F6, KEY.BAR_7, KEY.NZXT_2_12 ],
    [ KEY.COMMA, KEY.K, KEY.I, KEY.EIGHT, KEY.F7, KEY.BAR_8, KEY.NZXT_2_11 ],
    [ KEY.PERIOD, KEY.L, KEY.O, KEY.NINE, KEY.F8, KEY.BAR_9, KEY.NZXT_1_5, KEY.NZXT_1_16, KEY.NZXT_2_10 ],
    [ KEY.RIGHT_ALT, KEY.PERIOD, KEY.L, KEY.O, KEY.NINE, KEY.F9, KEY.BAR_10, KEY.NZXT_2_9 ],
    [ KEY.RIGHT_WIN, KEY.FORWARD_SLASH, KEY.SEMICOLON, KEY.P, KEY.ZERO, KEY.BAR_11, KEY.NZXT_2_8 ],
    [ KEY.APP_SELECT, KEY.APOSTROPHE, KEY.OPEN_BRACKET, KEY.MINUS, KEY.F10, KEY.BAR_12, KEY.NZXT_1_6, KEY.NZXT_1_15, KEY.NZXT_2_7 ],
    [ KEY.CLOSE_BRACKET, KEY.EQUALS, KEY.F11, KEY.BAR_13, KEY.NZXT_2_6 ],
    [ KEY.RIGHT_CTRL, KEY.RIGHT_SHIFT, KEY.ENTER, KEY.BACKSLASH, KEY.BACKSPACE, KEY.F12, KEY.NZXT_2_5 ],
    [ KEY.ARROW_LEFT, KEY.DELETE, KEY.INSERT, KEY.PRINT_SCREEN, KEY.BAR_14, KEY.NZXT_1_7, KEY.NZXT_1_14, KEY.NZXT_2_4 ],
    [ KEY.ARROW_DOWN, KEY.ARROW_UP, KEY.END, KEY.HOME, KEY.SCROLL_LOCK, KEY.NZXT_2_3 ],
    [ KEY.ARROW_RIGHT, KEY.PAGE_DOWN, KEY.PAGE_UP, KEY.PAUSE_BREAK, KEY.BAR_15 ],
    [ KEY.NUM_0, KEY.NUM_1, KEY.NUM_4, KEY.NUM_7, KEY.NUM_LOCK, KEY.STOP, KEY.MUTE, KEY.BAR_16, KEY.NZXT_1_8, KEY.NZXT_1_13 ],
    [ KEY.NUM_2, KEY.NUM_5, KEY.NUM_8, KEY.NUM_SLASH, KEY.PREV, KEY.BAR_17, KEY.NZXT_2_2 ],
    [ KEY.NUM_DOT, KEY.NUM_3, KEY.NUM_6, KEY.NUM_9, KEY.BAR_18, KEY.NUM_ASTERISK, KEY.PLAY ],
    [ KEY.NUM_ENTER, KEY.NUM_PLUS, KEY.NUM_MINUS, KEY.NEXT, KEY.BAR_19, KEY.NZXT_1_9, KEY.NZXT_1_12, KEY.NZXT_2_1 ],
];

function subtract(x, y) {
    return parseInt(x - y);
}