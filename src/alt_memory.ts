import { Module } from "./module";
import { AvalonSlave, Interface } from "./interface";
import { SopcInfoModule } from "./sopcinfo";

class MemoryDevice extends Module {
    public size: number;
    public writable: boolean;
    public dualPort: boolean;
    public buffer: ArrayBuffer;
    public i32: Int32Array;
    public s1: AvalonSlave;
    public s2: AvalonSlave;

    load(moddesc: SopcInfoModule): Promise<void> {
        let p = moddesc.parameter || {};
        let i = moddesc.interface;
        this.options.printInfo(`[${this.path}] Memory device (${this.size} bytes)`, 2);
        if (this.writable == null) {
            this.writable = true;
        }
        if (this.dualPort == null) {
            this.dualPort = false;
        }
        this.buffer = new ArrayBuffer(this.size);
        this.i32 = new Int32Array(this.buffer);
        function requireAvalonSlave(i: Interface): AvalonSlave {
            if (i instanceof AvalonSlave) {
                return i;
            }
            throw new Error(`slave "${i.name}" is not AvalonSlave interface`);
        }
        this.s1 = requireAvalonSlave(this.loadInterface(i.s1));
        if (this.dualPort) {
            this.s2 = requireAvalonSlave(this.loadInterface(i.s2));
        }
        return Module.prototype.load.call(this, moddesc);
    }

    connect(): void {
        this.s1.read32 = (offset: number, count?: number) => {
            return this.i32.subarray(offset, (count != null) ? (offset + count) : undefined);
        };
        if (this.s2 != null) {
            this.s2.read32 = this.s1.read32;
        }
        return Module.prototype.connect.call(this);
    }
}

class AlteraAvalonOnchipMemory2 extends MemoryDevice {
    static kind = "altera_avalon_onchip_memory2";

    load(moddesc: SopcInfoModule): Promise<void> {
        let p = moddesc.parameter || {};
        this.writable = p.writable.value === "true";
        this.dualPort = p.dualPort.value === "true";
        this.size = parseInt((p.memorySize || <any>{}).value || 0);
        return MemoryDevice.prototype.load.call(this, moddesc);
    }
}
Module.register(AlteraAvalonOnchipMemory2);

class AlteraAvalonNewSDRAMController extends MemoryDevice {
    static kind = "altera_avalon_new_sdram_controller";

    load(moddesc: SopcInfoModule): Promise<void> {
        let p = moddesc.parameter || {};
        this.size = parseInt((p.size || <any>{}).value || 0);
        return MemoryDevice.prototype.load.call(this, moddesc);
    }
}
Module.register(AlteraAvalonNewSDRAMController);
