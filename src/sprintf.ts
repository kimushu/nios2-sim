const RE = /%([#0 +-]*)(\*|\d*)((?:\.\d+)?)([diuoxXeEfFgGcs%])/g;
const RP = function (values: any[], match: any, flags: string, s_width: string, s_prec: string, type: string) {
    let v: any;
    let prefix: boolean;
    let zero: boolean;
    let sign: boolean;
    let lalign: boolean;
    let c, i, len, p, ref, s;
    ref = flags.split("");
    for (i = 0, len = ref.length; i < len; i++) {
        c = ref[i];
        switch (c) {
            case "#":
                prefix = true;
                break;
            case "0":
                zero = true;
                break;
            case " ":
                zero = false;
                break;
            case "+":
                sign = true;
                break;
            case "-":
                lalign = true;
                zero = false;
                break;
        }
    }
    let width: number;
    if (s_width === "") {
        width = 0;
    } else if (s_width === "*") {
        width = parseInt(values.shift()) || 0;
    } else {
        width = parseInt(s_width);
    }
    let prec: number = s_prec === "" ? null : parseInt(s_prec.substr(1));
    if (type === "%") {
        return "%";
    }
    p = "";
    s = "";
    v = values.shift();
    switch (type) {
        case "d":
        case "i":
        case "u":
            if (isNaN(v = parseInt(v))) {
                break;
            }
            if (prec == null) {
                prec = 1;
            }
            if (prec === 0 && v === 0) {
                v = "";
                break;
            }
            s = v < 0 ? "-" : sign ? "+" : "";
            v = Math.abs(v).toString(10);
            while (v.length < prec) {
                v = "0" + v;
            }
            break;
        case "o":
            if (isNaN(v = parseInt(v))) {
                break;
            }
            if (prec == null) {
                prec = 0;
            }
            s = v < 0 ? "-" : sign ? "+" : "";
            v = Math.abs(v).toString(8);
            while (v.length < prec) {
                v = "0" + v;
            }
            if (prefix && v[0] !== "0") {
                p = "0";
            }
            break;
        case "x":
        case "X":
            if (isNaN(v = parseInt(v))) {
                break;
            }
            if (prec == null) {
                prec = 0;
            }
            s = v < 0 ? "-" : sign ? "+" : "";
            v = Math.abs(v).toString(16);
            while (v.length < prec) {
                v = "0" + v;
            }
            if (type === "X") {
                v = v.toUpperCase();
                if (prefix) {
                    p = "0X";
                }
            } else {
                if (prefix) {
                    p = "0x";
                }
            }
            break;
        case "c":
            v = String.fromCharCode(parseInt(v));
            break;
        case "s":
            zero = false;
            break;
    }
    if (lalign) {
        v = "" + s + p + v;
        while (v.length < width) {
            v = v + " ";
        }
    } else if (zero) {
        width -= s.length + p.length;
        while (v.length < width) {
            v = "0" + v;
        }
        v = "" + s + p + v;
    } else {
        v = "" + s + p + v;
        while (v.length < width) {
            v = " " + v;
        }
    }
    return v;
};

export function sprintf(format: string, ...values: any[]) {
    return format.replace(RE, (...args: any[]) => (<any>RP)(values, ...args));
}

export function hex8(value: number): string {
    return `0000000${(value >>> 0).toString(16)}`.substr(-8);
}

export function hex8p(value: number): string {
    return `0x${hex8(value)}`;
}

export function dec12(value: number): string {
    return `00000000000${(value >>> 0)}`.substr(-12);
}
