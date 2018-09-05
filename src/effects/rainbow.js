let r = 255, g = 0, b = 0;
let rf = false, gf = true, bf = false;
let step = 1;

export default () => {
    if (rf) {
        r += step;
        b -= step;

        if (r === 255) {
            gf = true;
            rf = false;
        }
    }

    if (gf) {
        g += step;
        r -= step;

        if (g === 255) { 
            bf = true;
            gf = false;
        }
    }

    if (bf) {
        b += step;
        g -= step;

        if (b === 255) {
            rf = true;
            bf = false;
        }
    }

    return {
        r, g, b
    };
}