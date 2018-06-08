let count = 0;
let step = 1;
let rf = 0, gf = 0, bf = 0;
let flag = false;

export default () => {
    const values = [];

    if (rf === COLORS[count][0] && gf === COLORS[count][1] && bf === COLORS[count][2] && !flag) {
        flag = true;
    } else if (rf === 0 && gf === 0 && bf === 0 && flag) {
        flag = false;

        if (count === COLORS.length - 1) {
            count = 0;
        } else {
            count++;
        }
    } else {
        if (flag) {
            if (rf !== 0)
                rf -= step
    
            if (gf !== 0)
                gf -= step
    
            if (bf !== 0)
                bf -= step
        } else {
            if (rf !== COLORS[count][0])
                rf += step
    
            if (gf !== COLORS[count][1])
                gf += step
    
            if (bf !== COLORS[count][2])
                bf += step
        }
    }

    return {
        r: rf,
        g: gf,
        b: bf
    };
}

const COLORS = [
    [ 255,   0,   0],
    [ 255, 255,   0],
    [   0, 255,   0],
    [   0, 255, 255],
    [   0,   0, 255],
    [ 255,   0, 255],
]
