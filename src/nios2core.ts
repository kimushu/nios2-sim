import { hex8p as HEX8 } from "./sprintf";
import { Promiseable } from "./promiseable";

const list = {};
const TYPE_I = 0;
const TYPE_J = 1;
const TYPE_R = 2;

function def(op, type, exec, disas) {
    list[op] = {
        type: type,
        exec: exec,
        disas: disas
    };
}

function call_op(iw: number, m: string, _this) {
    let inst, op;
    op = iw & 0x3f;
    if (op === 0x3a) {
        op += (iw >> 3) & 0x3f00;
    }
    inst = list[op];
    if (inst == null) {
        throw 0;
    }
    switch (inst.type) {
        case TYPE_I:
            return inst[m].call(_this, (iw >> 27) & 0x1f, (iw >> 22) & 0x1f, (iw << 10) >> 16);
        case TYPE_J:
            return inst[m].call(_this, iw >>> 6);
        case TYPE_R:
            return inst[m].call(_this, (iw >> 27) & 0x1f, (iw >> 22) & 0x1f, (iw >> 17) & 0x1f, (iw >> 6) & 0x7ff);
    }
}

export function exec(iw: number): Promiseable<number> {
    return call_op(iw, "exec", this);
}

export function disas(iw: number): void {
    return call_op(iw, "disas", this);
}

const ZR = 0;
const EA = 29;
const BA = 30;
const RA = 31;

const GPRN = {
    0: "zero",
    1: "at",
    24: "et",
    25: "bt",
    26: "gp",
    27: "sp",
    28: "fp",
    29: "ea",
    30: "ba",
    31: "ra"
};

for (let i = 0, j = 0; j < 32; i = ++j) {
    if (GPRN[i] == null) {
        GPRN[i] = "r" + i;
    }
}

const CTRN = {
    0: "status",
    1: "estatus",
    2: "bstatus",
    3: "ienable",
    4: "ipending",
    5: "cpuid",
    7: "exception",
    8: "pteaddr",
    9: "tlbacc",
    10: "tlbmisc",
    11: "eccinj",
    12: "badaddr",
    13: "config",
    14: "mpubase",
    15: "mpuacc"
};

for (let i = 0, k = 0; k < 32; i = ++k) {
    if (CTRN[i] == null) {
        CTRN[i] = "ctl" + i;
    }
}

function SE16(v: number): number {
    return (v << 16) >> 16;
}

function SE8(v: number): number {
    return (v << 24) >> 24;
}

function D_N(m: string): string {
    return m + "\t";
}

function D_D(m: string, v: number): string {
    return m + "\t" + v;
}

function D_H(m: string, v: number): string {
    return m + "\t" + (HEX8(v));
}

function D_R(m: string, x: number): string {
    return m + "\t" + GPRN[x];
}

function D_RC(m: string, x: number, n: number): string {
    return m + "\t" + GPRN[x] + ", " + CTRN[n];
}

function D_OR(m: string, v: number, x: number): string {
    return m + "\t" + v + "(" + GPRN[x] + ")";
}

function D_RD(m: string, x: number, v: number): string {
    return m + "\t" + GPRN[x] + ", " + v;
}

function D_RR(m: string, x: number, y: number): string {
    return m + "\t" + GPRN[x] + ", " + GPRN[y];
}

function D_ROR(m: string, x: number, v: number, y: number): string {
    return m + "\t" + GPRN[x] + ", " + v + "(" + GPRN[y] + ")";
}

function D_RRR(m: string, x: number, y: number, z: number): string {
    return m + "\t" + GPRN[x] + ", " + GPRN[y] + ", " + GPRN[z];
}

function D_RRH(m: string, x: number, y: number, v: number): string {
    return m + "\t" + GPRN[x] + ", " + GPRN[y] + ", " + (HEX8(v));
}

function D_RRD(m: string, x: number, y: number, v: number): string {
    return m + "\t" + GPRN[x] + ", " + GPRN[y] + ", " + v;
}

def(0x00, TYPE_J, function (u26) {
    this.gpr[RA] = this.pc + 4;
    return u26 << 2;
}, function (u26) {
    return D_H("call", u26 << 2);
});

def(0x01, TYPE_J, function (u26) {
    return u26 << 2;
}, function (u26) {
    return D_H("jmpi", u26 << 2);
});

def(0x03, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.dread8(this.gpr[ra] + s16);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldbu", rb, s16, ra);
});

def(0x04, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] + s16;
}, function (ra: number, rb: number, s16: number) {
    if (ra === ZR) {
        return D_RD("movi", rb, s16);
    }
    return D_RRD("addi", rb, ra, s16);
});

def(0x05, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.dwrite8(this.gpr[ra] + s16, this.gpr[rb]);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("stb", rb, s16, ra);
});

def(0x06, TYPE_I, function (ra: number, rb: number, s16: number) {
    return this.pc + 4 + s16;
}, function (ra: number, rb: number, s16: number) {
    return D_H("br", this.pc + 4 + s16);
});

def(0x07, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = SE8(this.dread8(this.gpr[ra] + s16));
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldb", rb, s16, ra);
});

def(0x08, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] >= s16 ? 1 : 0;
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("cmpgei", rb, ra, s16);
});

def(0x0b, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.dread16(this.gpr[ra] + s16);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldhu", rb, s16, ra);
});

def(0x0c, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] & (s16 & 0xffff);
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("andi", rb, ra, s16 & 0xffff);
});

def(0x0d, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.dwrite16(this.gpr[ra] + s16, this.gpr[rb]);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("sth", rb, s16, ra);
});

def(0x0e, TYPE_I, function (ra: number, rb: number, s16: number) {
    if (this.gpr[ra] >= this.gpr[rb]) {
        return this.pc + 4 + s16;
    }
}, function (ra: number, rb: number, s16: number) {
    return D_RRH("bge", ra, rb, this.pc + 4 + s16);
});

def(0x0f, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = SE16(this.dread16(this.gpr[ra] + s16));
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldh", rb, s16, ra);
});

def(0x10, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] < s16 ? 1 : 0;
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("cmplti", rb, ra, s16);
});

def(0x13, TYPE_I, function (ra: number, rb: number, s16: number) {
    throw 0;
}, function (ra: number, rb: number, s16: number) {
    return D_OR("initda", s16, ra);
});

def(0x14, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] | (s16 & 0xffff);
}, function (ra: number, rb: number, s16: number) {
    if (ra === ZR) {
        return D_RD("movui", rb, s16 & 0xffff);
    }
    return D_RRD("ori", rb, ra, s16 & 0xffff);
});

def(0x15, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.dwrite32(this.gpr[ra] + s16, this.gpr[rb]);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("stw", rb, s16, ra);
});

def(0x16, TYPE_I, function (ra: number, rb: number, s16: number) {
    if (this.gpr[ra] < this.gpr[rb]) {
        return this.pc + 4 + s16;
    }
}, function (ra: number, rb: number, s16: number) {
    return D_RRH("blt", ra, rb, this.pc + 4 + s16);
});

def(0x17, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.dread32(this.gpr[ra] + s16, 4);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldw", rb, s16, ra);
});

def(0x18, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] !== s16 ? 1 : 0;
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("cmpnei", rb, ra, s16);
});

def(0x1b, TYPE_I, function (ra: number, rb: number, s16: number) {
    throw 0;
}, function (ra: number, rb: number, s16: number) {
    return D_OR("flashda", s16, ra);
});

def(0x1c, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] ^ (s16 & 0xffff);
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("xori", rb, ra, s16 & 0xffff);
});

def(0x1e, TYPE_I, function (ra: number, rb: number, s16: number) {
    if (this.gpr[ra] !== this.gpr[rb]) {
        return this.pc + 4 + s16;
    }
}, function (ra: number, rb: number, s16: number) {
    return D_RRH("bne", ra, rb, this.pc + 4 + s16);
});

def(0x20, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] === s16 ? 1 : 0;
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("cmpeqi", rb, ra, s16);
});

def(0x23, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.ioread8(this.gpr[ra] + s16);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldbuio", rb, s16, ra);
});

def(0x24, TYPE_I, function (ra: number, rb: number, s16: number) {
    if (!this.cfg.mul) {
        throw "Unsupported";
    }
    let a = this.gpr[ra] >>> 0;
    let b = (a * s16);
    this.gpr[rb] = b >>> 0;
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("muli", rb, ra, s16);
});

def(0x25, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.iowrite8(this.gpr[ra] + s16, this.gpr[rb]);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("stbio", rb, s16, ra);
});

def(0x26, TYPE_I, function (ra: number, rb: number, s16: number) {
    if (this.gpr[ra] === this.gpr[rb]) {
        return this.pc + 4 + s16;
    }
}, function (ra: number, rb: number, s16: number) {
    return D_RRH("beq", ra, rb, this.pc + 4 + s16);
});

def(0x27, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = SE8(this.ioread8(this.gpr[ra] + s16));
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldbio", rb, s16, ra);
});

def(0x28, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] >= (s16 & 0xffff) ? 1 : 0;
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("cmpgeui", rb, ra, s16 & 0xffff);
});

def(0x2b, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.ioread16(this.gpr[ra] + s16);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldhuio", rb, s16, ra);
});

def(0x2c, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] & (s16 << 16);
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("andhi", rb, ra, s16 & 0xffff);
});

def(0x2d, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.iowrite16(this.gpr[ra] + s16, this.gpr[rb]);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("sthio", rb, s16, ra);
});

def(0x2e, TYPE_I, function (ra: number, rb: number, s16: number) {
    if ((this.gpr[ra] >>> 0) >= (this.gpr[rb] >>> 0)) {
        return this.pc + 4 + s16;
    }
}, function (ra: number, rb: number, s16: number) {
    return D_RRH("bgeu", ra, rb, this.pc + 4 + s16);
});

def(0x2f, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = SE16(this.ioread16(this.gpr[ra] + s16));
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldhio", rb, s16, ra);
});

def(0x30, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = (this.gpr[ra] >>> 0) < (s16 & 0xffff) ? 1 : 0;
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("cmpltui", rb, ra, s16 & 0xffff);
});

def(0x32, TYPE_R, function (ra: number, rb: number, rc: number, opx: number) {
    throw 0;
}, function (ra: number, rb: number, rc: number, opx: number) {
    let d, n;
    n = opx & 0xff;
    d = D_D("custom", n);
    d += ", " + (opx & 0x4000 ? GPRN[rc] : "c" + rc);
    d += ", " + (opx & 0x10000 ? GPRN[ra] : "c" + ra);
    d += ", " + (opx & 0x8000 ? GPRN[rb] : "c" + rb);
    return d;
});

def(0x33, TYPE_I, function (ra: number, rb: number, s16: number) {
    throw 0;
}, function (ra: number, rb: number, s16: number) {
    return D_OR("initd", s16, ra);
});

def(0x34, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] | (s16 << 16);
}, function (ra: number, rb: number, s16: number) {
    if (ra === ZR) {
        return D_RD("movhi", rb, s16 & 0xffff);
    }
    return D_RRD("orhi", rb, ra, s16 & 0xffff);
});

def(0x35, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.iowrite32(this.gpr[ra] + s16, this.gpr[rb]);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("stwio", rb, s16, ra);
});

def(0x36, TYPE_I, function (ra: number, rb: number, s16: number) {
    if ((this.gpr[ra] >>> 0) < (this.gpr[rb] >>> 0)) {
        return this.pc + 4 + s16;
    }
}, function (ra: number, rb: number, s16: number) {
    return D_RRH("bltu", ra, rb, this.pc + 4 + s16);
});

def(0x37, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.ioread32(this.gpr[ra] + s16);
}, function (ra: number, rb: number, s16: number) {
    return D_ROR("ldwio", rb, s16, ra);
});

def(0x38, TYPE_I, function (ra: number, rb: number, s16: number) {
    throw 0;
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("rdprs", rb, ra, s16);
});

def(0x3b, TYPE_I, function (ra: number, rb: number, s16: number) {
    throw 0;
}, function (ra: number, rb: number, s16: number) {
    return D_OR("flashd", s16, ra);
});

def(0x3c, TYPE_I, function (ra: number, rb: number, s16: number) {
    this.gpr[rb] = this.gpr[ra] ^ (s16 << 16);
}, function (ra: number, rb: number, s16: number) {
    return D_RRD("xorhi", rb, ra, s16 & 0xffff);
});

def(0x013a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.st = this.est;
    return this.gpr[EA];
}, function (ra: number, rb: number, rc: number) {
    return D_N("eret");
});

def(0x023a, TYPE_R, function (ra: number, rb: number, rc: number, opx: number) {
    let tmp, u5;
    u5 = opx & 0x1f;
    tmp = this.gpr[ra];
    this.gpr[rc] = (tmp << u5) | (tmp >>> (32 - u5));
}, function (ra: number, rb: number, rc: number, opx: number) {
    let u5;
    u5 = opx & 0x1f;
    return D_RRD("roli", rc, ra, u5);
});

def(0x033a, TYPE_R, function (ra: number, rb: number, rc: number) {
    let tmp, u5;
    u5 = this.gpr[rb] & 0x1f;
    tmp = this.gpr[ra];
    this.gpr[rc] = (tmp << u5) | (tmp >>> (32 - u5));
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("rol", rc, ra, rb);
});

def(0x043a, TYPE_R, function () {
    throw 0;
}, function () {
    return D_N("flashp");
});

def(0x053a, TYPE_R, function () {
    return this.gpr[RA];
}, function () {
    return D_N("ret");
});

def(0x063a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = ~(this.gpr[ra] | this.gpr[rb]);
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("nor", rc, ra, rb);
});

def(0x073a, TYPE_R, function (ra: number, rb: number, rc: number) {
    if (!this.cfg.mulx) {
        throw "Unsupported";
    }
    throw 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("mulxuu", rc, ra, rb);
});

def(0x083a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] >= this.gpr[rb] ? 1 : 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("cmpge", rc, ra, rb);
});

def(0x093a, TYPE_R, function () {
    this.st = this.bst;
    return this.gpr[BA];
}, function () {
    return D_N("bret");
});

def(0x0b3a, TYPE_R, function (ra: number, rb: number, rc: number) {
    let tmp, u5;
    u5 = this.gpr[rb] & 0x1f;
    tmp = this.gpr[ra];
    this.gpr[rc] = (tmp << (32 - u5)) | (tmp >>> u5);
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("ror", rc, ra, rb);
});

def(0x0c3a, TYPE_R, function (ra) {
    throw 0;
}, function (ra) {
    return D_R("flashi", ra);
});

def(0x0d3a, TYPE_R, function (ra) {
    return this.gpr[ra];
}, function (ra) {
    return D_R("jmp", ra);
});

def(0x0e3a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] & this.gpr[rb];
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("and", rc, ra, rb);
});

def(0x103a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] < this.gpr[rb] ? 1 : 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("cmplt", rc, ra, rb);
});

def(0x123a, TYPE_R, function (ra: number, rb: number, rc: number, opx: number) {
    let u5;
    u5 = opx & 0x1f;
    this.gpr[rc] = this.gpr[ra] << u5;
}, function (ra: number, rb: number, rc: number, opx: number) {
    let u5;
    u5 = opx & 0x1f;
    return D_RRD("slli", rc, ra, u5);
});

def(0x133a, TYPE_R, function (ra: number, rb: number, rc: number) {
    let u5;
    u5 = this.gpr[rb] & 0x1f;
    this.gpr[rc] = this.gpr[ra] << u5;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("sll", rc, ra, rb);
});

def(0x143a, TYPE_R, function (ra: number, rb: number, rc: number) {
    throw 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RR("wrprs", rc, ra);
});

def(0x163a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] | this.gpr[rb];
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("or", rc, ra, rb);
});

def(0x173a, TYPE_R, function (ra: number, rb: number, rc: number) {
    if (!this.cfg.mulx) {
        throw "Unsupported";
    }
    throw 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("mulxsu", rc, ra, rb);
});

def(0x183a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] !== this.gpr[rb] ? 1 : 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("cmpne", rc, ra, rb);
});

def(0x1a3a, TYPE_R, function (ra: number, rb: number, rc: number, opx: number) {
    this.gpr[rc] = this.gpr[ra] >>> (opx & 0x1f);
}, function (ra: number, rb: number, rc: number, opx: number) {
    return D_RRD("srli", rc, ra, opx & 0x1f);
});

def(0x1b3a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] >>> (this.gpr[rb] & 0x1f);
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("srl", rc, ra, rb);
});

def(0x1c3a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.pc + 4;
}, function (ra: number, rb: number, rc: number) {
    return D_R("nextpc", rc);
});

def(0x1d3a, TYPE_R, function (ra) {
    this.gpr[RA] = this.pc + 4;
    return this.gpr[ra];
}, function (ra) {
    return D_R("callr", ra);
});

def(0x1e3a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] ^ this.gpr[rb];
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("xor", rc, ra, rb);
});

def(0x1f3a, TYPE_R, function (ra: number, rb: number, rc: number) {
    if (!this.cfg.mulx) {
        throw "Unsupported";
    }
    throw 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("mulxss", rc, ra, rb);
});

def(0x203a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] === this.gpr[rb] ? 1 : 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("cmpeq", rc, ra, rb);
});

def(0x243a, TYPE_R, function (ra: number, rb: number, rc: number) {
    if (!this.cfg.div) {
        throw "Unsupported";
    }
    throw 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("divu", rc, ra, rb);
});

def(0x253a, TYPE_R, function (ra: number, rb: number, rc: number) {
    if (!this.cfg.div) {
        throw "Unsupported";
    }
    throw 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("div", rc, ra, rb);
});

def(0x263a, TYPE_R, function (ra: number, rb: number, rc: number, opx: number) {
    let n;
    n = opx & 0x1f;
    throw 0;
}, function (ra: number, rb: number, rc: number, opx: number) {
    let n;
    n = opx & 0x1f;
    return D_RC("rdctl", rc, n);
});

def(0x273a, TYPE_R, function (ra: number, rb: number, rc: number) {
    if (!this.cfg.mul) {
        throw "Unsupported";
    }
    let a = this.gpr[ra] >>> 0;
    let b = this.gpr[rb] >>> 0;
    // Caluculate with 2 parts to avoid rounding
    let c = (a * (b & 0xffff)) + ((a * (b >>> 16)) << 16);
    this.gpr[rc] = c >>> 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("mul", rc, ra, rb);
});

def(0x283a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = (this.gpr[ra] >>> 0) >= (this.gpr[rb] >>> 0) ? 1 : 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("cmpgeu", rc, ra, rb);
});

def(0x293a, TYPE_R, function (ra) {
    //throw 0;
    return;
}, function (ra) {
    return D_R("initi", ra);
});

def(0x2d3a, TYPE_R, function () {
    this.est = this.st;
    this.st &= ~3;
    this.gpr[EA] = this.pc + 4;
    return this.cfg.evec;
}, function (ra: number, rb: number, rc: number, opx: number) {
    return D_D("trap", opx & 0x1f);
});

def(0x2e3a, TYPE_R, function (ra: number, rb: number, rc: number, opx: number) {
    let n;
    n = opx & 0x1f;
    switch (n) {
        case 0:
            this.sts = this.gpr[ra];
            return;
    }
    throw 0;
}, function (ra: number, rb: number, rc: number, opx: number) {
    let n;
    n = opx & 0x1f;
    return D_RC("wrctl", ra, n);
});

def(0x303a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = (this.gpr[ra] >>> 0) < (this.gpr[rb] >>> 0) ? 1 : 0;
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("cmpgeu", rc, ra, rb);
});

def(0x313a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] + this.gpr[rb];
}, function (ra: number, rb: number, rc: number) {
    if (rb === ZR) {
        return D_RR("mov", rc, ra);
    }
    return D_RRR("add", rc, ra, rb);
});

def(0x343a, TYPE_R, function () {
    throw 0;
}, function (ra: number, rb: number, rc: number, opx: number) {
    return D_D("break", opx & 0x1f);
});

def(0x363a, TYPE_R, function () {
    throw 0;
}, function () {
    return D_N("sync");
});

def(0x393a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] - this.gpr[rb];
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("add", rc, ra, rb);
});

def(0x3a3a, TYPE_R, function (ra: number, rb: number, rc: number, opx: number) {
    this.gpr[rc] = this.gpr[ra] >> (opx & 0x1f);
}, function (ra: number, rb: number, rc: number, opx: number) {
    return D_RRD("srai", rc, ra, opx & 0x1f);
});

def(0x3b3a, TYPE_R, function (ra: number, rb: number, rc: number) {
    this.gpr[rc] = this.gpr[ra] >> (this.gpr[rb] & 0x1f);
}, function (ra: number, rb: number, rc: number) {
    return D_RRR("sra", rc, ra, rb);
});
