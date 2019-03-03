'use strict'

import ffi from 'ffi';
import ref from 'ref';
import StructType from 'ref-struct';
import ArrayType from 'ref-array';
import Enum from 'enum';
import path from 'path';

import enums from './lib/enums.js';
import utils from './lib/utils.js';

var CorsairLedId = ref.types.int
var CorsairAccessMode = ref.types.int
var CorsairError = ref.types.int

var CorsairLedColor = StructType({
    ledId: CorsairLedId,
    r: ref.types.int,
    g: ref.types.int,
    b: ref.types.int
})

var CorsairPhysicalLayout = ref.types.int
var CorsairLogicalLayout = ref.types.int

var CorsairDeviceInfo = StructType({
    type: ref.types.int,
    model: ref.types.CString,
    physicalLayout: CorsairPhysicalLayout,
    logicalLayout: CorsairLogicalLayout,
    capsMask: ref.types.int
})

var CorsairDeviceInfoPtr = ref.refType(CorsairDeviceInfo)

var CorsairLedPosition = StructType({
    ledId: CorsairLedId,
    top: ref.types.double,
    left: ref.types.double,
    height: ref.types.double,
    width: ref.types.double
})

var CorsairLedPositionArr = ArrayType(CorsairLedPosition)

var CorsairLedPositions = StructType({
    numberOfLeds: ref.types.int,
    pLedPosition: CorsairLedPositionArr
})

var CorsairLedPositionsPtr = ref.refType(CorsairLedPositions)

var CorsairProtocolDetails = StructType({
    sdkVersion: ref.types.CString,
    serverVersion: ref.types.CString,
    sdkProtocolVersion: ref.types.int,
    serverProtocolVersion: ref.types.int,
    breakingChanges: ref.types.bool
})

function CueError(err) {
    this.name = 'CueError'
    this.message =
    enums.CorsairError.get(Math.pow(2, err)).key +
    (err > 3 && err != 5
        ? ' -- this might be an error in the CueSDK wrapper, please contact the developer.'
        : '')
        let error = new Error(this.message)
        error.name = this.name
        this.stack =
        error.stack.split('\n')[0] +
        '\n' +
        error.stack
        .split('\n')
        .splice(3, error.stack.split('\n').length)
        .join('\n')
}
    
CueError.prototype = Error.prototype

class CueSDK {
    constructor(path, clear = false, exclusive = false) {
        this.CueSDKLib = ffi.Library(
            path,
            {
                CorsairSetLedsColors: ['bool', ['int', 'pointer']],
                CorsairSetLedsColorsAsync: [
                    'bool',
                    ['int', 'pointer', 'pointer', 'pointer']
                ],
                CorsairGetDeviceCount: ['int', []],
                CorsairGetDeviceInfo: [CorsairDeviceInfoPtr, ['int']],
                CorsairGetLedPositions: [CorsairLedPositionsPtr, []],
                CorsairGetLedIdForKeyName: [CorsairLedId, ['char']],
                CorsairRequestControl: ['bool', [CorsairAccessMode]],
                CorsairPerformProtocolHandshake: [CorsairProtocolDetails, []],
                CorsairSetLayerPriority: ['bool', ['int']],
                CorsairGetLastError: [CorsairError, []]
            }
        )
        
        this.details = this.CueSDKLib.CorsairPerformProtocolHandshake().toObject()
        this.lastError = 0
        this._error()
        
        // Request exclusive access to keyboard LEDs
        if (exclusive)
        this.CueSDKLib.CorsairRequestControl(
            enums.CorsairAccessMode.CAM_ExclusiveLightingControl
        )
        
        this.fps = 30
        this.fade_helper = new utils.fade()
        this.fadeType = 'Wheel'
        
        if (clear) {
            this.clear()
        }
        
        return this
    }
    
    set() {
        if (arguments[0] instanceof Array) {
            if (typeof arguments[1] === 'function') {
                return this.setAsync(...arguments)
            } else {
                return this.setSync(...arguments)
            }
        } else {
            if (typeof arguments[4] === 'function') {
                return this.setIndividualAsync(...arguments)
            } else {
                return this.setIndividualSync(...arguments)
            }
        }
    }
    
    setSync(a, ids = false) {
        let l = []
        if (ids) {
            for (let i = 0; i < a.length; i++) {
                l[i] = this._getLedColor(...a[i]).ref()
            }
        } else {
            for (let i = 0; i < a.length; i++) {
                let [key, r, g, b] = a[i]
                l[i] = this._getLedColor(this._getLedIdForKeyName(key), r, g, b).ref()
            }
        }
        let r = this.CueSDKLib.CorsairSetLedsColors(l.length, Buffer.concat(l))
        if (r) {
            return this
        } else {
            this._error()
            return this
        }
    }

    setIndividualSync(key, r, g, b, ids = false) {
        let l = this._getLedColor(
            ids ? key : this._getLedIdForKeyName(key),
            r,
            g,
            b
        ).ref()
        let re = this.CueSDKLib.CorsairSetLedsColors(1, l)
        if (re) {
            return this
        } else {
            this._error()
            return this
        }
    }
    
    setAsync(a, callback, ids = false) {
        let l = []
        if (ids) {
            for (let i = 0; i < a.length; i++) {
                l[i] = this._getLedColor(...a[i]).ref()
            }
        } else {
            for (let i = 0; i < a.length; i++) {
                let [key, r, g, b] = a[i]
                l[i] = this._getLedColor(this._getLedIdForKeyName(key), r, g, b).ref()
            }
        }
        let asyncFunc = ffi.Callback(
            'void',
            ['pointer', 'bool', CorsairError],
            (context, succes, error) => {
                if (succes) {
                    callback()
                } else {
                    this._error()
                }
            }
        )
        let re = this.CueSDKLib.CorsairSetLedsColorsAsync(
            l.length,
            Buffer.concat(l),
            asyncFunc,
            ref.NULL
        )
        if (re) {
            return asyncFunc
        } else {
            this._error()
            return asyncFunc
        }
    }
    
    setIndividualAsync(key, r, g, b, callback, ids = false) {
        let l = this._getLedColor(
            ids ? key : this._getLedIdForKeyName(key),
            r,
            g,
            b
        ).ref()
        let asyncFunc = ffi.Callback(
            'void',
            ['pointer', 'bool', CorsairError],
            (context, succes, error) => {
                if (succes) {
                    callback()
                } else {
                    this._error()
                }
            }
        )
        let re = this.CueSDKLib.CorsairSetLedsColorsAsync(1, l, asyncFunc, ref.NULL)
        if (re) {
            return asyncFunc
        } else {
            this._error()
            return asyncFunc
        }
    }

    fade() {
        if (arguments[0] instanceof Array) {
            return this.fadeAsync(...arguments)
        } else {
            return this.fadeIndividualAsync(...arguments)
        }
    }
    

    fadeAsync(k, f, t, l, cb = () => {}, ids = false) {
        this.fade_helper[this.fadeType](f, t, l, this.fps, (r, g, b) => {
            let a = []
            for (let i = 0; i < k.length; i++) {
                a.push([k[i], r, g, b])
            }
            this.setAsync(a, cb, ids)
        })
    }
    
    fadeIndividualAsync(k, f, t, l, cb = () => {}, ids = false) {
        // k = array of leds, f = from color, t = to color [r, g, b], l = time in ms
        this.fade_helper[this.fadeType](f, t, l, this.fps, (r, g, b) => {
            this.setIndividualAsync(
                k,
                r,
                g,
                b,
                r == t[0] && g == t[1] && b == t[2] ? cb : () => {},
                ids
            )
        })
    }
    
    clear() {
        let l = []
        for (let i = 1; i <= 188; i++) {
            l.push([i, 0, 0, 0])
        }
        this.set(l, true)
    }
    
    getLeds() {
        let p = this.CueSDKLib.CorsairGetLedPositions().deref()
        let l = p['pLedPosition']
        l.length = p['numberOfLeds']
        return l
    }
    
    close() {
        this.CueSDKLib._dl.close()
        this.CueSDKLib = {}
    }
    
    renew() {
        this.CueSDKLib.CorsairSetLayerPriority(127)
    }

    release() {
        this.CueSDKLib.CorsairSetLayerPriority(120)
    }
    
    _getLedColor(ledId, r, g, b) {
        let keyColor = new CorsairLedColor({ ledId, r, g, b })
        return keyColor
    }
    
    _getLedIdForKeyName(key) {
        return enums.CorsairLedId.get('CLK_' + key).value
    }
    
    _error() {
        this.lastError = this.CueSDKLib.CorsairGetLastError()
        if (this.lastError != 'CE_Success' && this.lastError != 0) {
            if (this.lastError === "CE_NoControl") return;
            // throw new CueError(this.lastError)
        }
    }
}

export default CueSDK;