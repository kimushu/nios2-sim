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

    load(moddesc: SopcInfoModule, s1name: string = "s1", s2name: string = "s2"): Promise<void> {
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
        this.s1 = <AvalonSlave>this.loadInterface(i[s1name]);
        if (this.dualPort) {
            this.s2 = <AvalonSlave>this.loadInterface(i[s2name]);
        }
        return Module.prototype.load.call(this, moddesc);
    }

    connect(): void {
        this.s1.read32 = (offset: number, count?: number): Int32Array => {
            return this.i32.subarray(offset, (count != null) ? (offset + count) : undefined);
        };
        if (this.writable) {
            this.s1.write32 = (offset: number, value: number, byteEnable: number = 0xffffffff): boolean => {
                this.i32[offset] = (this.i32[offset] & ~byteEnable) | (value & byteEnable);
                return true;
            };
        } else {
            this.s1.write32 = (offset: number, value: number, byteEnable?: number): boolean => {
                return true;
            };
        }
        if (this.s2 != null) {
            this.s2.read32 = this.s1.read32;
            this.s2.write32 = this.s1.write32;
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

class AlteraOnchipFlash extends MemoryDevice {
    static kind = "altera_onchip_flash";

    load(moddesc: SopcInfoModule): Promise<void> {
        let a = moddesc.assignment;
        this.size = 0;
        this.writable = false;
        if (a.embeddedsw.CMacro.READ_ONLY_MODE !== "1") {
            this.options.printWarn(`Write operations will be ignored: ${moddesc.path}`);
        }
        for (let sector = 1; sector <= 5; ++sector) {
            if (a.embeddedsw.CMacro[`SECTOR${sector}_ENABLED`] === "1") {
                this.size = parseInt(a.embeddedsw.CMacro[`SECTOR${sector}_END_ADDR`]) + 1;
            }
        }
        return MemoryDevice.prototype.load.call(this, moddesc, "data");
    }
}
Module.register(AlteraOnchipFlash);
