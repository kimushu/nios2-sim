import { ProcessorModule, ProcessorTimer } from "./module";
import { sprintf, hex8p, dec12, hex8 } from "./sprintf";
import * as core from "./nios2core";
import { AvalonMaster, Interface, InterruptReceiver, NiosCustomInstructionMaster } from "./interface";
import { SopcInfoModule } from "./sopcinfo";
import { Promiseable, then } from "./promiseable";

enum Nios2State {
    NOT_INITIALIZED,
    NOT_RUNNING,
    RUNNING,
    FETCHING_INSTRUCTION_WORDS,
    EXECUTING_INSTRUCTION,
    ABORTED,
    ABORTED_BY_INFINITE_LOOP = ABORTED,
}

interface Nios2Breakpoint {
    js?: boolean;
    empty?: number;
}

interface Nios2BreakpointSet {
    [addr: number]: Nios2Breakpoint;
}

interface Nios2Timer {
    cycles: number;
    listener: Function;
}

export class AlteraNios2 extends ProcessorModule {
    static kind = "altera_nios2_qsys";

    /** Processor configuration */
    public cfg: {
        bigEndian: boolean;
        b31Bypass: boolean;
        debug: boolean;
        div: boolean;
        mul: boolean;
        mulx: boolean;
        evec: number;
        rvec: number;
        icache: number;
        iline: number;
        dcache: number;
        dline: number;
        tcim: number;
        tcdm: number;
        cpuid: number;
        clockRate: number;
    };

    /** Instruction masters */
    public im: AvalonMaster[];

    /** Data masters */
    public dm: AvalonMaster[];

    /** Custom instruction services */
    public cim: NiosCustomInstructionMaster;

    /** Interrupt receiver */
    public irq: InterruptReceiver;

    /** status register */
    public status: number;

    /** estatus register */
    public estatus: number;

    /** bstatus register */
    public bstatus: number;

    /** ienable register */
    public ienable: number;

    /** Instruction pointer */
    public pc: number;

    /** General purpose registers */
    public gpr: Int32Array;

    /** FIXME: Total instructions executed */
    public icnt: number;

    /** Instruction word array */
    public inst: Int32Array;

    /** Current index in instruction word array */
    public iidx: number;

    /** Clock rate */
    get clockRate() { return this.cfg.clockRate; }

    /** Current state */
    private _state: Nios2State = Nios2State.NOT_INITIALIZED;

    /** Breakpoints */
    private _bkpt: Nios2BreakpointSet = {};

    /** Timers */
    private _timers: Nios2Timer[] = [];

    load(moddesc: SopcInfoModule): Promise<void> {
        let a = moddesc.assignment;
        let p = moddesc.parameter || {};
        let i = moddesc.interface;
        this.cfg = {
            bigEndian: (p.setting_bigEndian || <any>{}).value === "true",
            b31Bypass: (p.setting_bit31BypassDCache || <any>{}).value === "true",
            debug: (p.debug_enabled || <any>{}).value === "true",
            div: a.embeddedsw.CMacro.HARDWARE_DIVIDE_PRESENT === "1",
            mul: a.embeddedsw.CMacro.HARDWARE_MULTIPLY_PRESENT === "1",
            mulx: a.embeddedsw.CMacro.HARDWARE_MULX_PRESENT === "1",
            evec: parseInt(a.embeddedsw.CMacro.EXCEPTION_ADDR || 0),
            rvec: parseInt(a.embeddedsw.CMacro.RESET_ADDR || 0),
            icache: parseInt(a.embeddedsw.CMacro.ICACHE_SIZE || 0),
            iline: parseInt(a.embeddedsw.CMacro.ICACHE_LINE_SIZE || 0),
            dcache: parseInt(a.embeddedsw.CMacro.DCACHE_SIZE || 0),
            dline: parseInt(a.embeddedsw.CMacro.DCACHE_LINE_SIZE || 0),
            tcim: parseInt((p.icache_numTCIM || <any>{}).value || 0),
            tcdm: parseInt((p.dcache_numTCDM || <any>{}).value || 0),
            cpuid: parseInt(a.embeddedsw.CMacro.CPUID_VALUE || 0),
            clockRate: parseInt(i.clk.parameter.clockRate.value),
        };
        this.im = [(<AvalonMaster>this.loadInterface(i.instruction_master))];
        for (let n = 0; n < this.cfg.tcim; ++n) {
            this.im.push(<AvalonMaster>this.loadInterface(i[`tightly_coupled_instruction_master_${n}`]));
        }
        this.dm = [(<AvalonMaster>this.loadInterface(i.data_master))];
        for (let n = 0; n < this.cfg.tcdm; ++n) {
            this.dm.push(<AvalonMaster>this.loadInterface(i[`tightly_coupled_data_master_${n}`]));
        }
        if (i.custom_instruction_master) {
            this.cim = <NiosCustomInstructionMaster>this.loadInterface(i.custom_instruction_master);
        }
        if (this.cfg.debug) {
            this.loadInterface(i.debug_mem_slave);
        }
        this.irq = <InterruptReceiver>this.loadInterface(i.irq);
        let summary = [];
        if (this.cfg.icache > 0) {
            summary.push(`ICache=${this.cfg.icache / 1024}k`);
        }
        if (this.cfg.dcache > 0) {
            summary.push(`DCache=${this.cfg.dcache / 1024}k`);
        }
        summary.push(`#IMaster=${this.im.length}`);
        summary.push(`#DMaster=${this.dm.length}`);
        if (this.cfg.div) {
            summary.push("hw-div");
        }
        if (this.cfg.mul) {
            summary.push("hw-mul");
        }
        if (this.cfg.mulx) {
            summary.push("hw-mulx");
        }
        this.options.printInfo(`[${this.path}] NiosII processor (${summary.join(", ")})`, 2);
        for (let bkpt of this.options.breakJs) {
            this.options.printInfo(`[${this.path}] Breakpoint (JS) set at ${bkpt.name || ""}(${hex8p(bkpt.value)})`);
            this._bkpt[bkpt.value] = { js: true };
        }
        for (let empf of this.options.emptyFunc) {
            this.options.printInfo(`[${this.path}] Empty function set at ${empf.name || ""}(${hex8p(empf.value)})`);
            this._bkpt[empf.value] = { empty: (empf.result != null) ? empf.result : null };
        }
        return ProcessorModule.prototype.load.call(this, moddesc);
    }

    loadProgram(addr: number, data: Buffer): Promise<void> {
        let msg = `Cannot write memory from ${hex8p(addr)}`;
        let array = new Int8Array(data);
        for (let im of this.im) {
            let result = im.read8(addr, array.length);
            if (result != null) {
                return Promise.resolve(result)
                .then((i8) => {
                    if (i8.length !== array.length) {
                        throw new Error(`${msg}: Not memory block`);
                    }
                    i8.set(array);
                    return im.read8(addr, array.length);
                })
                .then((i8) => {
                    if (Buffer.from([i8]).compare(Buffer.from([array])) !== 0) {
                        throw new Error(`${msg}: Verify failed`);
                    }
                });
            }
        }
        return Promise.reject(new Error(`${msg}: No slave found`));
    }

    resetProcessor(): void {
        this.status = 0;
        this.estatus = 0;
        this.bstatus = 0;
        this.pc = this.cfg.rvec;
        this.gpr = new Int32Array(32);
        this.gpr.fill(0xdeadbeef, 1);
        this.cycles = 0;
        this.icnt = 0;
        this.inst = null;
        this.iidx = null;
        this._state = Nios2State.NOT_RUNNING;
    }

    runProcessor(steps: number = Infinity): Promise<number> {
        if (this._state === Nios2State.NOT_INITIALIZED) {
            return Promise.reject(new Error("Not initialized"));
        }
        if (this._state > Nios2State.RUNNING) {
            return Promise.reject(new Error("Operation waiting"));
        }
        if (this._state >= Nios2State.ABORTED) {
            return Promise.reject(new Error("Already aborted"));
        }
        let total: number;
        this._state = Nios2State.RUNNING;
        for (total = 0; steps > 0; ++total, --steps) {
            // Internal interrupt check
            if ((this.status & 1) && (this.irq.pending & this.ienable)) {
                if (!(this.status & 4)) {
                    this.estatus = this.status;
                }
                this.status &= ~1;
                this.gpr[29] = this.pc;
                this.pc = this.cfg.evec;
                this.inst = null;
                if (this.options.cpuTrace) {
                    console.log(`(${dec12(this.icnt)}) [Internal interrupt]`);
                }
            }

            // Load instruction word
            let iw;
            for (;;) {
                iw = (this.inst || [])[this.iidx];
                if (iw != null) {
                    break;
                }
                this.inst = null;
                this.iidx = 0;
                for (let im of this.im) {
                    let result = im.read32(this.pc);
                    if (result instanceof Promise) {
                        this._state = Nios2State.FETCHING_INSTRUCTION_WORDS;
                        return result.then((i32) => {
                            this._state = Nios2State.RUNNING;
                            this.inst = i32;
                            return total;
                        });
                    }
                    if (result != null) {
                        this.inst = result;
                        break;
                    }
                }
                if ((this.inst == null) || (this.inst.byteLength < 4)) {
                    return Promise.reject(
                        new Error(`No valid instruction memory for pc=${hex8p(this.pc)}`)
                    );
                }
            }

            // Breakpoint check
            let bkpt = this._bkpt[this.pc];
            if (bkpt && bkpt.empty !== undefined) {
                // Empty function
                if (this.options.cpuTrace) {
                    console.log(`(${dec12(this.icnt)}) ${hex8(this.pc)}: xxxxxxxx\tsimret\t${
                        (bkpt.empty != null) ? bkpt.empty : "(void)"}`);
                }
                if (bkpt.empty != null) {
                    this.gpr[2] = bkpt.empty;
                }
                let result = this._cpu_finish(this.gpr[31]);
                if (result != null) {
                    return result;
                }
                continue;
            }

            // Trace
            if (this.options.cpuTrace) {
                console.log(`(${dec12(this.icnt)}) ${hex8(this.pc)}: ${hex8(iw)}\t${this._cpu_disas(iw)}`);
            }

            if (bkpt) {
                if (this.options.cpuTrace) {
                    console.log(`(${dec12(this.icnt)}) [Breakpoint]`);
                }
                if (bkpt.js) {
                    debugger;
                }
            }

            // Execute instruction
            let newpc = this._cpu_exec(iw);
            if (newpc instanceof Promise) {
                this._state = Nios2State.EXECUTING_INSTRUCTION;
                return newpc.then((newpc: number) => {
                    this._state = Nios2State.RUNNING;
                    return this._cpu_finish(newpc);
                })
                .then(() => {
                    return total + 1;
                });
            }

            let result = this._cpu_finish(newpc);
            if (result != null) {
                return result;
            }
        }
        return Promise.resolve(total);
    }

    addTimer(cycles: number, listener: Function): ProcessorTimer {
        let timer: Nios2Timer = { cycles, listener };
        this._timers.push(timer);
        return { clear: () => {
            timer.cycles = -1;
        }};
    }

    private _cpu_finish(newpc: number): Promiseable<never> {
        this.gpr[0] = 0;
        ++this.cycles;

        let expired = false;
        for (let timer of this._timers) {
            if (timer.cycles <= 0) {
                expired = true;
            } else if (--timer.cycles === 0) {
                timer.listener();
                expired = true;
            }
        }
        if (expired) {
            this._timers = this._timers.filter((timer) => timer.cycles > 0);
        }

        ++this.icnt;
        if (newpc != null) {
            // Jump
            if (newpc === this.pc) {
                this._state = Nios2State.ABORTED_BY_INFINITE_LOOP;
                return Promise.reject(
                    new Error(`Simulation aborted by infinite loop at ${this.pc}`)
                );
            }
            this.iidx += (newpc - this.pc) >> 2;
            this.pc = newpc;
        } else {
            // No jump
            ++this.iidx;
            this.pc += 4;
        }
    }

    private _cpu_exec = core.exec;
    private _cpu_disas = core.disas;

    ioread8(addr: number): Promiseable<number> {
        return this.dread8(addr | 0x80000000);
    }

    ioread16(addr: number): Promiseable<number> {
        return this.dread16(addr | 0x80000000);
    }

    ioread32(addr: number): Promiseable<number> {
        return this.dread32(addr | 0x80000000);
    }

    iowrite8(addr: number, value: number): Promiseable<boolean> {
        return this.dwrite8(addr | 0x80000000, value);
    }

    iowrite16(addr: number, value: number): Promiseable<boolean> {
        return this.dwrite16(addr | 0x80000000, value);
    }

    iowrite32(addr: number, value: number): Promiseable<boolean> {
        return this.dwrite32(addr | 0x80000000, value);
    }

    dwrite8(addr: number, value: number): Promiseable<boolean> {
        addr = (addr & 0x7fffffff) >>> 0;
        for (let dm of this.dm) {
            let result = dm.write8(addr, value);
            if (result != null) {
                return result;
            }
        }
        return Promise.reject(
            new Error(`invalid 8-bit data write addr=${hex8p(addr)}`)
        );
    }

    dwrite16(addr: number, value: number): Promiseable<boolean> {
        addr = (addr & 0x7fffffff) >>> 0;
        for (let dm of this.dm) {
            let result = dm.write16(addr, value);
            if (result != null) {
                return result;
            }
        }
        return Promise.reject(
            new Error(`invalid 16-bit data write addr=${hex8p(addr)}`)
        );
    }

    dwrite32(addr: number, value: number): Promiseable<boolean> {
        addr = (addr & 0x7fffffff) >>> 0;
        for (let dm of this.dm) {
            let result = dm.write32(addr, value);
            if (result != null) {
                return result;
            }
        }
        return Promise.reject(
            new Error(`invalid 32-bit data write addr=${hex8p(addr)}`)
        );
    }

    dread8(addr: number): Promiseable<number> {
        addr = (addr & 0x7fffffff) >>> 0;
        for (let dm of this.dm) {
            let result = dm.read8(addr, 1);
            if (result != null) {
                return then(result, (array) => array[0]);
            }
        }
        return Promise.reject(
            new Error(`invalid 8-bit data read addr=${hex8p(addr)}`)
        );
    }

    dread16(addr: number): Promiseable<number> {
        addr = (addr & 0x7fffffff) >>> 0;
        for (let dm of this.dm) {
            let result = dm.read16(addr, 2);
            if (result != null) {
                return then(result, (array) => array[0]);
            }
        }
        return Promise.reject(
            new Error(`invalid 16-bit data read addr=${hex8p(addr)}`)
        );
    }

    dread32(addr: number): Promiseable<number> {
        addr = (addr & 0x7fffffff) >>> 0;
        for (let dm of this.dm) {
            let result = dm.read32(addr, 4);
            if (result != null) {
                return then(result, (array) => array[0]);
            }
        }
        return Promise.reject(
            new Error(`invalid 32-bit data read addr=${hex8p(addr)}`)
        );
    }
}
ProcessorModule.register(AlteraNios2);

class AlteraNios2Gen2 extends AlteraNios2 {
    static kind = "altera_nios2_gen2";
}
ProcessorModule.register(AlteraNios2Gen2);
