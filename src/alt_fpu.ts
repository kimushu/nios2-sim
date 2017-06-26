import { Module } from "./module";
import { AvalonSlave, Interface, NiosCustomInstructionSlave } from "./interface";
import { SopcInfoModule } from "./sopcinfo";

const MNEMONIC_COMBI = [
    "fabss", "fnegs", "fcmpnes", "fcmpeqs",
    "fcmpges", "fcmpgts", "fcmples", "fcmplts",
    "fmaxs", "fmins"
];
const MNEMONIC_MULTI = [
    "round", "fixsi", "floatis", "fsqrts",
    "fmuls", "fadds", "fsubs", "fdivs"
];

class AlteraNiosFpu2 extends Module {
    static kind: string = "altera_nios_custom_instr_floating_point_2";

    private _arith: boolean;
    private _roots: boolean;
    private _convs: boolean;
    private _comps: boolean;
    public s1: NiosCustomInstructionSlave;
    public s2: NiosCustomInstructionSlave;

    load(moddesc: SopcInfoModule): Promise<void> {
        let p = moddesc.parameter;
        this._arith = (p.arithmetic_present.value === "true");
        this._roots = (p.root_present.value === "true");
        this._convs = (p.conversion_present.value === "true");
        this._comps = (p.comparison_present.value === "true");
        let i = moddesc.interface;
        this.s1 = <NiosCustomInstructionSlave>this.loadInterface(i.s1);
        this.s1.getMnemonic = (n: number): string => MNEMONIC_COMBI[n];
        this.s1.execute = (n: number, a: number, b: number, c: number): number => {
            let i = new Int32Array([a, b, 0]);
            let f = new Float32Array(i.buffer);
            switch (n) {
                case 0:
                    // fabss
                    f[2] = Math.abs(f[0]);
                    return this._arith ? i[2] : null;
                case 1:
                    // fnegs
                    f[2] = -f[0];
                    return this._arith ? i[2] : null;
                case 2:
                    // fcmpnes
                    return this._comps ? ((f[0] !== f[1]) ? 1 : 0) : null;
                case 3:
                    // fcmpeqs
                    return this._comps ? ((f[0] === f[1]) ? 1 : 0) : null;
                case 4:
                    // fcmpges
                    return this._comps ? ((f[0] >= f[1]) ? 1 : 0) : null;
                case 5:
                    // fcmpgts
                    return this._comps ? ((f[0] > f[1]) ? 1 : 0) : null;
                case 6:
                    // fcmples
                    return this._comps ? ((f[0] <= f[1]) ? 1 : 0) : null;
                case 7:
                    // fcmplts
                    return this._comps ? ((f[0] < f[1]) ? 1 : 0) : null;
                case 8:
                    // fmaxs
                    return this._comps ? ((f[0] < f[1]) ? i[1] : i[0]) : null;
                case 9:
                    // fmins
                    return this._comps ? ((f[0] < f[1]) ? i[0] : i[1]) : null;
            }
        };
        this.s2 = <NiosCustomInstructionSlave>this.loadInterface(i.s2);
        this.s2.getMnemonic = (n: number): string => MNEMONIC_MULTI[n];
        this.s2.execute = (n: number, a: number, b: number, c: number): number => {
            let i = new Int32Array([a, b, 0]);
            let f = new Float32Array(i.buffer);
            switch (n) {
                case 0:
                    // round
                    return this._convs ? Math.round(f[0]) : null;
                case 1:
                    // fixsi
                    return this._convs ? parseInt(<any>f[0]) : null;
                case 2:
                    // floatis
                    f[2] = i[0];
                    return this._convs ? i[2] : null;
                case 3:
                    // fsqrts
                    f[2] = Math.sqrt(f[0]);
                    return this._roots ? i[2] : null;
                case 4:
                    // fmuls
                    f[2] = f[0] * f[1];
                    return this._arith ? i[2] : null;
                case 5:
                    // fadds
                    f[2] = f[0] + f[1];
                    return this._arith ? i[2] : null;
                case 6:
                    // fsubs
                    f[2] = f[0] - f[1];
                    return this._arith ? i[2] : null;
                case 7:
                    // fdivs
                    f[3] = f[0] / f[1];
                    return this._arith ? i[2] : null;
            }
        };
        return Module.prototype.load.call(this, moddesc);
    }
}
Module.register(AlteraNiosFpu2);
