import { Module } from "./module";
import { sprintf } from "./sprintf";
import * as core from "./nios2core";
import { AvalonMaster, Interface } from "./interface";

function DEC12(x: number): string {
    return `00000000000${x}`.substr(-12);
}

function HEX8(v: number): string {
    return "0x" + `0000000${v.toString(16)}`.substr(-8);
}

class AlteraNios2 extends Module {
    static kind = "altera_nios2_qsys";
    public isProcessor = true;

    /** Processor configuration */
    public cfg;

    /** Instruction masters */
    public im: Interface[];

    /** Data masters */
    public dm: Interface[];

    /** status register */
    public sts: number;

    /** estatus register */
    public est: number;

    /** bstatus register */
    public bst: number;

    /** ipending register */
    public ipend: number;

    /** Instruction pointer */
    public pc: number;

    /** Instruction word */
    public iw: number;

    /** General purpose registers */
    public gpr: number[];

    /** FIXME: Exception vector? */
    public excc: number;

    /** FIXME: Total instructions executed */
    public icnt: number;

    /** FIXME: */
    public iidx: number;

    load(module) {
        let a = module.assignment;
        let p = module.parameter;
        let i = module["interface"];
        this.cfg = {
            bigEndian: (p.setting_bigEndian || {}).value === "true",
            b31Bypass: (p.setting_bit31BypassDCache || {}).value === "true",
            debug: (p.debug_enabled || {}).value === "true",
            div: a.embeddedsw.CMacro.HARDWARE_DIVIDE_PRESENT === "1",
            mul: a.embeddedsw.CMacro.HARDWARE_MULTIPLY_PRESENT === "1",
            mulx: a.embeddedsw.CMacro.HARDWARE_MULX_PRESENT === "1",
            evec: parseInt(a.embeddedsw.CMacro.EXCEPTION_ADDR || 0),
            rvec: parseInt(a.embeddedsw.CMacro.RESET_ADDR || 0),
            icache: parseInt(a.embeddedsw.CMacro.ICACHE_SIZE || 0),
            iline: parseInt(a.embeddedsw.CMacro.ICACHE_LINE_SIZE || 0),
            dcache: parseInt(a.embeddedsw.CMacro.DCACHE_SIZE || 0),
            dline: parseInt(a.embeddedsw.CMacro.DCACHE_LINE_SIZE || 0),
            tcim: parseInt((p.icache_numTCIM || {}).value || 0),
            tcdm: parseInt((p.dcache_numTCDM || {}).value || 0)
        };
        this.im = [this.loadInterface(i.instruction_master)];
        for (let n = 0; n < this.cfg.tcim; ++n) {
            this.im[n + 1] = this.loadInterface(i["tightly_coupled_instruction_master_" + n]);
        }
        this.dm = [this.loadInterface(i.data_master)];
        for (let n = 0; n < this.cfg.tcdm; ++n) {
            this.dm[n + 1] = this.loadInterface(i["tightly_coupled_data_master_" + n]);
        }
        if (this.cfg.debug) {
            this.loadInterface(i.debug_mem_slave);
        }
        let summary = [];
        if (this.cfg.icache > 0) {
            summary.push("ICache=" + (this.cfg.icache / 1024) + "k");
        }
        if (this.cfg.dcache > 0) {
            summary.push("DCache=" + (this.cfg.dcache / 1024) + "k");
        }
        summary.push("#IMaster=" + this.im.length);
        summary.push("#DMaster=" + this.dm.length);
        if (this.cfg.div) {
            summary.push("hw-div");
        }
        if (this.cfg.mul) {
            summary.push("hw-mul");
        }
        if (this.cfg.mulx) {
            summary.push("hw-mulx");
        }
        this.options.printInfo("[" + this.path + "] NiosII processor (" + (summary.join(", ")) + ")", 2);
        return Module.prototype.load.call(this, module);
    }

    loadProgram(addr, data) {
        var array, im, j, len, ref, result;
        array = new Int8Array(data);
        ref = this.im;
        for (j = 0, len = ref.length; j < len; j++) {
            im = ref[j];
            result = im.write8(addr, array);
            if (result != null) {
                return result;
            }
        }
        throw Error("Cannot write memory from 0x" + (addr.toString(16)));
    }

    resetProcessor() {
        this.sts = 0;
        this.est = 0;
        this.bst = 0;
        this.ipend = 0;
        this.excc = 0;
        this.pc = this.cfg.rvec;
        this.icnt = 0;
        this.iw = null;
        this.iidx = null;
    }

    cpu_work(count) {
        var im, iw, j, len, newpc, ref, ref1, ref2;
        if (count == null) {
            count = 256;
        }
        while (count > 0) {
            count -= 1;
            while (true) {
                iw = (ref = this.iw) != null ? ref[this.iidx] : void 0;
                if (iw != null) {
                    break;
                }
                this.iw = null;
                this.iidx = 0;
                ref1 = this.im;
                for (j = 0, len = ref1.length; j < len; j++) {
                    im = ref1[j];
                    this.iw = im.read32(this.pc);
                    if (this.iw != null) {
                        break;
                    }
                }
                if (!(((ref2 = this.iw) != null ? ref2.length : void 0) > 0)) {
                    throw Error(`No valid instruction memory for pc=0x${this.pc.toString(16)}`);
                }
            }
            if (this.options.cpuTrace) {
                console.log("(" + (DEC12(this.icnt)) + ") " + (HEX8(this.pc)) + ": " + (HEX8(iw)) + "\t" + (this.cpu_disas(iw)));
            }
            newpc = this.cpu_exec(iw);
            this.gpr[0] = 0;
            this.icnt += 1;
            if (newpc != null) {
                if (newpc === this.pc) {
                    return Promise.reject(Error("Simulation aborted by infinite loop"));
                }
                this.iidx += (newpc - this.pc) >> 2;
                this.pc = newpc;
            } else {
                this.iidx += 1;
                this.pc += 4;
            }
        }
    }

    cpu_exec = core.exec;
    cpu_disas = core.disas;

    dwrite8(addr, value) {
        var dm, j, len, ref;
        ref = this.dm;
        for (j = 0, len = ref.length; j < len; j++) {
            dm = ref[j];
            if (dm.write8(addr, [value])) {
                return true;
            }
        }
        return false;
    }

    dwrite16(addr, value) {
        var dm, j, len, ref;
        ref = this.dm;
        for (j = 0, len = ref.length; j < len; j++) {
            dm = ref[j];
            if (dm.write16(addr, [value])) {
                return true;
            }
        }
        return false;
    }

    dwrite32(addr, value) {
        var dm, j, len, ref;
        ref = this.dm;
        for (j = 0, len = ref.length; j < len; j++) {
            dm = ref[j];
            if (dm.write32(addr, [value])) {
                return true;
            }
        }
        return false;
    }

    dread8(addr: number) {
        var a, dm, j, len, ref;
        ref = this.dm;
        for (j = 0, len = ref.length; j < len; j++) {
            dm = ref[j];
            a = dm.read8(addr, 1);
            if (a != null) {
                return a[0];
            }
        }
        throw Error(`invalid data read addr=0x${addr.toString(16)}`);
    }

    dread16(addr: number) {
        var a, dm, j, len, ref;
        ref = this.dm;
        for (j = 0, len = ref.length; j < len; j++) {
            dm = ref[j];
            a = dm.read16(addr, 1);
            if (a != null) {
                return a[0];
            }
        }
        throw Error(`invalid data read addr=0x${addr.toString()}`);
    }

    dread32(addr: number) {
        var a, dm, j, len, ref;
        ref = this.dm;
        for (j = 0, len = ref.length; j < len; j++) {
            dm = ref[j];
            a = dm.read32(addr, 1);
            if (a != null) {
                return a[0];
            }
        }
        throw Error(`invalid data read addr=0x${addr.toString(16)}`);
    }
}
Module.register(AlteraNios2);

class AlteraNios2Gen2 extends AlteraNios2 {
    static kind = "altera_nios2_gen2";
}
Module.register(AlteraNios2Gen2);
