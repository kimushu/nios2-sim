import { Module } from "./module";
import { SopcInfoModule } from "./sopcinfo";
import { AvalonSlave, requireInterface, InterruptSender, ClockSink } from "./interface";

class AlteraAvalonTimer extends Module {
    static kind = "altera_avalon_timer";

    public clk: ClockSink;
    public s1: AvalonSlave;
    public irq: InterruptSender;

    private _clockRate: number;
    private _bits: number;
    private _loadValue: number;
    private _alwaysRun: boolean;
    private _fixedPeriod: boolean;
    private _snapshotEn: boolean;

    private _running: boolean;
    private _timeout: boolean;
    private _genirq: boolean;
    private _cont: boolean;
    private _period: number;
    private _current: number;
    private _snapshot: number;

    load(moddesc: SopcInfoModule) {
        let a = moddesc.assignment;
        this._clockRate = parseInt(a.embeddedsw.CMacro.FREQ);
        this._bits = parseInt(a.embeddedsw.CMacro.COUNTER_SIZE);
        this._loadValue = parseInt(a.embeddedsw.CMacro.LOAD_VALUE);
        this._alwaysRun = (a.embeddedsw.CMacro.ALWAYS_RUN === "1");
        this._fixedPeriod = (a.embeddedsw.CMacro.FIXED_PERIOD === "1");
        this._snapshotEn = (a.embeddedsw.CMacro.SNAPSHOT === "1");

        this._running = this._alwaysRun;
        this._timeout = false;
        this._genirq = false;
        this._cont = false;
        this._period = this._loadValue;
        this._current = this._period;
        this._snapshot = 0;

        let i = moddesc.interface;
        this.irq = requireInterface(this.loadInterface(i.irq), InterruptSender);
        this.s1 = requireInterface(this.loadInterface(i.s1), AvalonSlave);
        this.s1.readReg = this._readReg.bind(this);
        this.s1.writeReg = this._writeReg.bind(this);
        return Module.prototype.load.call(this, moddesc);
    }

    private _readReg(offset: number): number {
        if (offset >= 4 && this._bits === 32) {
            offset += 2;
        }
        switch (offset) {
            case 0:
                return (
                    (this._timeout ? 0x0001 : 0) |
                    (this._running ? 0x0002 : 0)
                );
            case 1:
                return (
                    (this._genirq  ? 0x0001 : 0) |
                    (this._cont    ? 0x0002 : 0)
                );
            case 2:
                return (this._period >> 0) & 0xffff;
            case 3:
                return (this._period >> 16) & 0xffff;
            case 4:
                return (this._period >> 32) & 0xffff;
            case 5:
                return 0;
            case 6:
                return (this._snapshot >> 0) & 0xffff;
            case 7:
                return (this._snapshot >> 16) & 0xffff;
            case 8:
                return (this._snapshot >> 32) & 0xffff;
            case 9:
                return 0;
        }
    }

    private _writeReg(offset: number, value: number): boolean {
        if (offset >= 4 && this._bits === 32) {
            offset += 2;
        }
        switch (offset) {
            case 0:
                if ((value & 0x0001) === 0) {
                    this._timeout = false;
                }
                return true;
            case 1:
                this._genirq = !!(value & 0x0001);
                this._cont = !!(value & 0x0002);
                if (this._running) {
                    if (!this._alwaysRun && (value & 0x0008)) {
                        // STOP
                        this._running = false;  // FIXME
                    }
                } else if (value & 0x0004) {
                    // START
                    this._running = true;   // FIXME
                }
                return true;
            case 2:
                this._period -= ((this._period & 0xffff) >>> 0);
                this._period += ((value & 0xffff) >>> 0);
                return true;
            case 3:
                this._period -= ((this._period & 0xffff0000) >>> 0);
                this._period += ((value & 0xffff) >>> 0) << 16;
                return true;
            case 4:
                this._period = ((this._period & 0xffffffff) >>> 0);
                this._period += ((value & 0xffff) >>> 0) << 32;
                return true;
            case 5:
                if (value !== 0) {
                    throw new Error("Timer emulation does not support >= 48bit value");
                }
                return true;
            case 6:
            case 7:
            case 8:
            case 9:
                this._snapshot = this._current;
                return true;
        }
        return false;
    }
}
Module.register(AlteraAvalonTimer);
