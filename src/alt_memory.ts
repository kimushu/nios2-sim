import { Module } from "./module";
import { AvalonSlave } from "./interface";

class MemoryDevice extends Module {
    public size: number;
    public writable: boolean;
    public dualPort: boolean;
    public buffer: ArrayBuffer;
    public i32: Int32Array;
    public s1: AvalonSlave;
    public s2: AvalonSlave;

    load(module) {
        var i, p;
        p = module.parameter;
        i = module["interface"];
        this.options.printInfo(`[${this.path}] Memory device (${this.size} bytes)`, 2);
        if (this.writable == null) {
            this.writable = true;
        }
        if (this.dualPort == null) {
            this.dualPort = false;
        }
        this.buffer = new ArrayBuffer(this.size);
        this.i32 = new Int32Array(this.buffer);
        this.s1 = <AvalonSlave>this.loadInterface(i.s1);
        if (this.dualPort) {
            this.s2 = <AvalonSlave>this.loadInterface(i.s2);
        }
        return Module.prototype.load.call(this, module);
    }

    connect() {
        var ref;
        this.s1.read32 = (function (_this) {
            return function (offset, count) {
                return _this.i32.subarray(offset, count != null ? offset + count : void 0);
            };
        })(this);
        if ((ref = this.s2) != null) {
            ref.read32 = this.s1.read32;
        }
        return Module.prototype.connect.call(this);
    }
}

class AlteraAvalonOnchipMemory2 extends MemoryDevice {
    static kind = "altera_avalon_onchip_memory2";

    load(module) {
        var p, ref;
        p = module.parameter;
        this.writable = p.writable.value === "true";
        this.dualPort = p.dualPort.value === "true";
        this.size = parseInt((ref = p.memorySize) != null ? ref.value : void 0);
        return MemoryDevice.prototype.load.call(this, module);
    }
}
Module.register(AlteraAvalonOnchipMemory2);

class AlteraAvalonNewSDRAMController extends MemoryDevice {
    static kind = "altera_avalon_new_sdram_controller";

    load(module) {
        var p, ref;
        p = module.parameter;
        this.size = parseInt((ref = p.size) != null ? ref.value : void 0);
        return MemoryDevice.prototype.load.call(this, module);
    }
}
Module.register(AlteraAvalonNewSDRAMController);
