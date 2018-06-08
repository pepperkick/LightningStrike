import KEY from '../objects/keys';

let row = 0;
let color = 0;

export default (keys) => { 
    for (let i = 0; i < PATH[row].length; i++) {
        keys[PATH[row][i]] = [ COLORS[color][0], COLORS[color][1], COLORS[color][2] ];  
    }

    if (row === PATH.length - 1) {
        row = -1;

        if (color === COLORS.length - 1) {
            color = -1;
        }

        color++;
    }

    row++;

    return {
        keys
    }
}

const PATH = [
    [ KEY.AURA ],
    [ KEY.LOGITECH ],
    [ KEY.BAR_1, KEY.BAR_2, KEY.BAR_3, KEY.BAR_4, KEY.BAR_5, KEY.BAR_6, KEY.BAR_7, KEY.BAR_8, KEY.BAR_9 ], 
    [ KEY.BAR_10, KEY.BAR_11, KEY.BAR_12, KEY.BAR_13, KEY.BAR_14, KEY.BAR_15, KEY.BAR_16, KEY.BAR_17, KEY.BAR_18, KEY.BAR_19 ],
    [ KEY.NEXT, KEY.PLAY, KEY.PREV, KEY.STOP, KEY.PAUSE_BREAK, KEY.SCROLL_LOCK, KEY.PRINT_SCREEN, KEY.F12, KEY.F11, KEY.F10, KEY.F9, KEY.F8, KEY.F7, KEY.F6, KEY.F5, KEY.F4, KEY.F3, KEY.F2, KEY.F1, KEY.ESCAPE, KEY.G1 ],
    [ KEY.G2, KEY.TILDE, KEY.ONE, KEY.TWO, KEY.THREE, KEY.FOUR, KEY.FIVE, KEY.SIX, KEY.SEVEN, KEY.EIGHT, KEY.NINE, KEY.ZERO, KEY.MINUS, KEY.EQUALS, KEY.BACKSPACE, KEY.INSERT, KEY.HOME, KEY.PAGE_UP, KEY.NUM_LOCK, KEY.NUM_SLASH, KEY.NUM_ASTERISK, KEY.NUM_MINUS ],
    [ KEY.NUM_PLUS, KEY.NUM_9, KEY.NUM_8, KEY.NUM_7, KEY.PAGE_DOWN, KEY.END, KEY.DELETE, KEY.BACKSLASH, KEY.CLOSE_BRACKET, KEY.OPEN_BRACKET, KEY.P, KEY.O, KEY.I, KEY.U, KEY.Y, KEY.T, KEY.R, KEY.E, KEY.W, KEY.Q, KEY.TAB, KEY.G3 ],
    [ KEY.G4, KEY.CAPS_LOCK, KEY.A, KEY.S, KEY.D, KEY.F, KEY.G, KEY.H, KEY.J, KEY.K, KEY.L, KEY.SEMICOLON, KEY.APOSTROPHE, KEY.ENTER, KEY.NUM_4, KEY.NUM_5, KEY.NUM_6, KEY.NUM_PLUS, KEY.NUM_ENTER ],
    [ KEY.NUM_3, KEY.NUM_2, KEY.NUM_1, KEY.ARROW_UP, KEY.RIGHT_SHIFT, KEY.FORWARD_SLASH, KEY.PERIOD, KEY.COMMA, KEY.M, KEY.N, KEY.B, KEY.V, KEY.C, KEY.X, KEY.Z, KEY.LEFT_SHIFT, KEY.G5 ],
    [ KEY.G6, KEY.LEFT_CTRL, KEY.LEFT_WIN, KEY.LEFT_ALT, KEY.SPACE, KEY.RIGHT_ALT, KEY.RIGHT_WIN, KEY.APP_SELECT, KEY.RIGHT_CTRL, KEY.ARROW_LEFT, KEY.ARROW_DOWN, KEY.ARROW_RIGHT, KEY.NUM_0, KEY.NUM_DOT, KEY.NUM_ENTER ]
];

const COLORS = [
    [ 255,   0,   0 ],
    [ 240,  15,   0 ],
    [ 225,  30,   0 ],
    [ 210,  45,   0 ],
    [ 195,  60,   0 ],
    [ 180,  75,   0 ],
    [ 165,  90,   0 ],
    [ 150, 105,   0 ],
    [ 135, 120,   0 ],
    [ 120, 135,   0 ],
    [ 105, 150,   0 ],
    [  90, 165,   0 ],
    [  75, 180,   0 ],
    [  60, 195,   0 ],
    [  45, 210,   0 ],
    [  30, 225,   0 ],
    [  15, 240,   0 ],
    [   0, 255,   0 ],
    [   0, 240,  15 ],
    [   0, 225,  30 ],
    [   0, 210,  45 ],
    [   0, 195,  60 ],
    [   0, 180,  75 ],
    [   0, 165,  90 ],
    [   0, 150, 105 ],
    [   0, 135, 120 ],
    [   0, 120, 135 ],
    [   0, 105, 150 ],
    [   0,  90, 165 ],
    [   0,  75, 180 ],
    [   0,  60, 195 ],
    [   0,  45, 210 ],
    [   0,  30, 225 ],
    [   0,  15, 240 ],
    [   0,   0, 255 ],
    [  15,   0, 240 ],
    [  30,   0, 225 ],
    [  45,   0, 210 ],
    [  60,   0, 195 ],
    [  75,   0, 180 ],
    [  90,   0, 165 ],
    [ 105,   0, 150 ],
    [ 120,   0, 135 ],
    [ 135,   0, 120 ],
    [ 150,   0, 105 ],
    [ 165,   0,  90 ],
    [ 180,   0,  75 ],
    [ 195,   0,  60 ],
    [ 210,   0,  45 ],
    [ 225,   0,  30 ],
    [ 240,   0,  15 ],
    [ 255,   0,   0 ],
]