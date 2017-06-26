import { Module } from "./module";
import { SimulatorOptions } from "./simulator";
import { Qsys } from "./qsys";
import { SopcInfoInterface } from "./sopcinfo";
import { then, Promiseable } from "./promiseable";

export interface InterfaceConstructor extends Function {
    readonly kind: string;
    new(module: Module, options: SimulatorOptions): Interface;
}

export class Interface {
    static subclasses: {[kind: string]: InterfaceConstructor} = {};

    /**
     * Register interface class
     * @param subclass Constructor of Interface subclass
     */
    static register(subclass: InterfaceConstructor): void {
        this.subclasses[subclass.kind] = subclass;
    }

    /**
     * Lookup interface constructor from its kind
     * @param kind Kind of interface
     */
    static search(kind: string): InterfaceConstructor {
        return this.subclasses[kind];
    }

    /**
     * System which this interface belongs to
     */
    public system: Qsys;

    /**
     * Name of this interface
     */
    public name: string;

    /**
     * Construct interface
     * @param module Module instance which owns this interface
     * @param options Simulator options 
     */
    constructor(public module: Module, public options: SimulatorOptions) {
        this.system = this.module.system;
        return;
    }

    /**
     * Load interface from sopcinfo
     * @param ifdesc Interface descriptor in sopcinfo
     */
    load(ifdesc: SopcInfoInterface): void {
        this.name = ifdesc.name;
    }

    /**
     * Connect interface to the other module
     */
    connect(): void {
    }
}

interface AvalonSlaveLink {
    bridge: boolean;
    moduleName: string;
    interfaceName: string;
    base: number;
    size: number;
    end: number;
    link: AvalonSlave;
}

/**
 * Avalon-MM Master interface
 */
export class AvalonMaster extends Interface {
    static kind = "avalon_master";
    private _slaves: AvalonSlaveLink[];

    load(ifdesc: SopcInfoInterface): void {
        this._slaves = [];
        for (let blk of ifdesc.memoryBlock) {
            let slave: AvalonSlaveLink = {
                bridge: blk.isBridge === "true",
                moduleName: blk.moduleName,
                interfaceName: blk.slaveName,
                base: parseInt(blk.baseAddress),
                size: parseInt(blk.span),
                end: null,
                link: null,
            };
            slave.end = slave.base + slave.size;
            this._slaves.push(slave);
        }
        this._slaves.sort((a, b) => a.base - b.base);
        return Interface.prototype.load.call(this, ifdesc);
    }

    connect(): void {
        for (let slave of this._slaves) {
            let target = this.module.system.modules[slave.moduleName];
            this.options.printInfo(`Connecting: ${this.module.path}.${this.name} => ${target.path}.${slave.interfaceName}`, 3);
            slave.link = <AvalonSlave>target.interfaces[slave.interfaceName];
            if (slave.link == null) {
                throw Error("No target slave (" + slave.moduleName + "." + slave["interfaceName"] + ") in this system");
            }
        }
    }

    /**
     * Lookup slave from address
     * @param byteAddr Byte address
     */
    private _getSlave(byteAddr: number): AvalonSlaveLink {
        let top: number = 0;
        let btm: number = this._slaves.length;
        while (top < btm) {
            let mid = (top + btm) >>> 1;
            let slave = this._slaves[mid];
            if (byteAddr < slave.base) {
                btm = mid;
            } else if (byteAddr >= slave.end) {
                top = mid + 1;
            } else {
                return slave;
            }
        }
    }

    /**
     * Read data as 8-bit array
     * @param byteAddr Byte address
     * @param byteLength Byte length of request data
     */
    read8(byteAddr: number, byteLength?: number): Promiseable<Int8Array> {
        let s = this._getSlave(byteAddr);
        if (s != null) {
            return s.link.read8((byteAddr - s.base) >>> 0, byteLength);
        }
    }

    /**
     * Read data as 16-bit array
     * @param byteAddr Byte address
     * @param byteLength Byte length of request data
     */
    read16(byteAddr: number, byteLength?: number): Promiseable<Int16Array> {
        let s = this._getSlave(byteAddr);
        if (s != null) {
            return s.link.read16((byteAddr - s.base) >>> 1, (byteLength != null) ? ((byteLength + 1) >> 1) : null);
        }
    }

    /**
     * Read data as 32-bit array
     * @param byteAddr Byte address
     * @param byteLength Byte length of request data
     */
    read32(byteAddr: number, byteLength?: number): Promiseable<Int32Array> {
        let s = this._getSlave(byteAddr);
        if (s != null) {
            return s.link.read32((byteAddr - s.base) >>> 2, (byteLength != null) ? ((byteLength + 3) >> 2) : null);
        }
    }

    /**
     * Write 8-bit data
     * @param byteAddr Byte address
     * @param value 8-bit value
     */
    write8(byteAddr: number, value: number) {
        let s = this._getSlave(byteAddr);
        if (s != null) {
            return s.link.write8((byteAddr - s.base) >>> 0, value);
        }
    }

    /**
     * Write 16-bit data
     * @param byteAddr Byte address
     * @param value 16-bit value
     */
    write16(byteAddr: number, value: number) {
        let s = this._getSlave(byteAddr);
        if (s != null) {
            return s.link.write16((byteAddr - s.base) >>> 1, value);
        }
    }

    /**
     * Write 32-bit data
     * @param byteAddr Byte address
     * @param value 32-bit value
     */
    write32(byteAddr: number, value: number) {
        let s = this._getSlave(byteAddr);
        if (s != null) {
            return s.link.write32((byteAddr - s.base) >>> 2, value);
        }
    }
}
Interface.register(AvalonMaster);

/**
 * Avalon-MM Slave interface
 */
export class AvalonSlave extends Interface {
    static kind = "avalon_slave";

    load(ifc): void {
        return Interface.prototype.load.call(this, ifc);
    }

    /**
     * Read data as 8-bit array
     * @param offset Byte offset
     * @param count Number of bytes to read
     */
    read8(offset: number, count?: number): Promiseable<Int8Array> {
        let boff = offset & 3;
        let off32 = offset >>> 2;
        let cnt32 = (count != null) ? ((boff + count + 3) >>> 2): null;
        return then(
            this.read32(off32, cnt32),
            (i32) => new Int8Array(i32.buffer, i32.byteOffset + boff, i32.byteLength - boff)
        );
    }

    /**
     * Read data as 16-bit array
     * @param offset 16-bit Word offset
     * @param count Number of 16-bit words to read
     */
    read16(offset: number, count?: number): Promiseable<Int16Array> {
        let woff = offset & 1;
        let off32 = offset >>> 1;
        let cnt32 = (count != null) ? ((woff + count + 1) >>> 1) : null;
        return then(
            this.read32(off32, cnt32),
            (i32) => new Int16Array(i32.buffer, i32.byteOffset + woff * 2, i32.byteLength - woff * 2)
        );
    }

    /**
     * Read data as 32-bit array
     * @param offset 32-bit Word offset
     * @param count Number of 32-bit words to read
     */
    read32(offset: number, count?: number): Promiseable<Int32Array> {
        let value = this.readReg(offset);
        if (value != null) {
            return then(value, (value) => new Int32Array([value]));
        }
    }

    /**
     * Read 32-bit register (for CSR)
     * @param offset Register offset
     */
    readReg: (this: AvalonSlave, offset: number) => Promiseable<number>;

    /**
     * Write 8-bit data
     * @param offset Byte offset
     * @param value 8-bit value
     */
    write8(offset: number, value: number): Promiseable<boolean> {
        let shift = ((offset & 3) << 3);
        return this.write32(offset >>> 2, value << shift, 0xff << shift);
    }

    /**
     * Write 16-bit data
     * @param offset 16-bit word offset
     * @param value 16-bit value
     */
    write16(offset: number, value: number): Promiseable<boolean> {
        let shift = ((offset & 2) << 3);
        return this.write32(offset >>> 1, value <<shift, 0xffff << shift);
    }

    /**
     * Write 32-bit data
     * @param offset 32-bit word offset
     * @param value 32-bit value
     */
    write32(offset: number, value: number, byteEnable: number = 0xffffffff): Promiseable<boolean> {
        if (byteEnable === 0xffffffff) {
            return this.writeReg(offset, value);
        }
        throw new Error(`Unsupported write access to offset ${offset}`);
    }

    /**
     * Write 32-bit register (for CSR)
     * @param offset Register offset
     * @param value 32-bit value
     */
    writeReg: (this: AvalonSlave, offset: number, value: number) => Promiseable<boolean>;
}
Interface.register(AvalonSlave);

export class AvalonSink extends Interface {
    static kind = "avalon_streaming_sink";
}
Interface.register(AvalonSink);

export class AvalonSource extends Interface {
    static kind = "avalon_streaming_source";
}
Interface.register(AvalonSource);

export class ClockSink extends Interface {
    static kind = "clock_sink";

    public clockRate: number;

    load(ifdesc: SopcInfoInterface): Promise<void> {
        let rate = ifdesc.parameter.clockRate;
        if (rate != null) {
            this.clockRate = parseInt(rate.value);
        }
        return Interface.prototype.load.call(this, ifdesc);
    }
}
Interface.register(ClockSink);

export class ClockSource extends Interface {
    static kind = "clock_source";
}
Interface.register(ClockSource);

export class Conduit extends Interface {
    static kind = "conduit_end";
}
Interface.register(Conduit);

interface IrqSenderLink {
    moduleName: string;
    interfaceName: string;
    irqNumber: number;
    link: InterruptSender;
}

export class InterruptReceiver extends Interface {
    static kind = "interrupt_receiver";

    public request: number = 0;

    private _senders: IrqSenderLink[] = [];

    load(ifdesc: SopcInfoInterface): void {
        let i = ifdesc.interrupt;
        for (let name of Object.keys(i)) {
            this._senders.push({
                moduleName: i[name].moduleName,
                interfaceName: i[name].slaveName,
                irqNumber: parseInt(i[name].interruptNumber),
                link: null,
            });
        }
        return Interface.prototype.load.call(this, ifdesc);
    }

    connect(): void {
        for (let sender of this._senders) {
            let target = this.system.modules[sender.moduleName];
            sender.link = <InterruptSender>target.interfaces[sender.interfaceName];
            if (sender.link != null) {
                sender.link.irqNumber = sender.irqNumber;
                sender.link.receiver = this;
            }
        }
        return Interface.prototype.connect.call(this);
    }

    assert(irqNumber: number): void {
        this.request |= (1 << irqNumber);
    }

    deassert(irqNumber: number): void {
        this.request &= ~(1 << irqNumber);
    }
}
Interface.register(InterruptReceiver);

export class InterruptSender extends Interface {
    static kind = "interrupt_sender";

    public receiver: InterruptReceiver;
    public irqNumber: number;
}
Interface.register(InterruptSender);

interface CustomInstrSlaveLink {
    moduleName: string;
    interfaceName: string;
    opcodeMnemonic: string;
    opcodeNumber: number;
    opcodeCount: number;
    link: NiosCustomInstructionSlave;
}

export class NiosCustomInstructionMaster extends Interface {
    static kind = "nios_custom_instruction_master";

    private _slaves: CustomInstrSlaveLink[] = [];

    load(ifdesc: SopcInfoInterface): void {
        let i = ifdesc.customInstruction;
        for (let name of Object.keys(i)) {
            this._slaves.push({
                moduleName: i[name].moduleName,
                interfaceName: i[name].slaveName,
                opcodeMnemonic: i[name].opcodeMnemonic,
                opcodeNumber: parseInt(i[name].opcodeNumber),
                opcodeCount: 0,
                link: null,
            });
        }
        this._slaves.sort((a, b) => a.opcodeNumber - b.opcodeNumber);
        return Interface.prototype.load.call(this, ifdesc);
    }

    connect(): void {
        for (let slave of this._slaves) {
            let target = this.system.modules[slave.moduleName];
            if (target != null) {
                slave.link = <NiosCustomInstructionSlave>target.interfaces[slave.interfaceName];
                slave.link.opcodeMnemonic = slave.opcodeMnemonic;
                slave.link.opcodeNumber = slave.opcodeNumber;
                slave.opcodeCount = slave.link.opcodeCount;
            }
        }
        return Interface.prototype.connect.call(this);
    }

    /**
     * Get mnemonic of custom instruction
     * @param n Custom instruction opcode (0~255)
     */
    getMnemonic(n: number): string {
        let slave = this._getSlave(n);
        if (slave != null) {
            let method = slave.link.getMnemonic;
            return method ? method.call(slave.link, n - slave.opcodeNumber) : null;
        }
    }

    /**
     * Execute custom instruction
     * @param n Instruction select number
     * @param a Register rA value or cA index
     * @param b Register rB value or cB index
     * @param c cC index
     */
    execute(n: number, a: number, b: number, c: number): Promiseable<number> {
        let slave = this._getSlave(n);
        if (slave != null) {
            let result = slave.link.execute(n - slave.opcodeNumber, a, b, c);
            if (result != null) {
                return result;
            }
            throw new Error(`No custom instruction executor for n=${n}`);
        }
        throw new Error(`No custom instruction slave for n=${n}`);
    }

    /**
     * Lookup custom instruction slave from opcode
     * @param opcode Custom instruction opcode (0~255)
     */
    private _getSlave(n: number): CustomInstrSlaveLink {
        let top: number = 0;
        let btm: number = this._slaves.length;
        while (top < btm) {
            let mid = (top + btm) >>> 1;
            let slave = this._slaves[mid];
            if (n < slave.opcodeNumber) {
                btm = mid;
            } else if (n >= (slave.opcodeNumber + slave.opcodeCount)) {
                top = mid + 1;
            } else {
                return slave;
            }
        }
    }
}
Interface.register(NiosCustomInstructionMaster);

export class NiosCustomInstructionSlave extends Interface {
    static kind = "nios_custom_instruction_slave";

    public opcodeCount: number;

    public opcodeMnemonic: string;
    public opcodeNumber: number;

    load(ifdesc: SopcInfoInterface): void {
        this.opcodeCount = 1 << parseInt(ifdesc.parameter.NPort.value);
        return Interface.prototype.load.call(this, ifdesc);
    }

    /**
     * Get mnemonic of custom instruction
     * @param n Instruction select number
     */
    getMnemonic: (n: number) => string;

    /**
     * Execute custom instruction
     * @param n Instruction select number
     * @param a Register rA value or cA index
     * @param b Register rB value or cB index
     * @param c Register cC index
     */
    execute: (n: number, a: number, b: number, c: number) => Promiseable<number>;
}
Interface.register(NiosCustomInstructionSlave);

export class ResetSink extends Interface {
    static kind = "reset_sink";
}
Interface.register(ResetSink);

export class ResetSource extends Interface {
    static kind = "reset_source";
}
Interface.register(ResetSource);
