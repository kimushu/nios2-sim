interface InterfaceConstructor extends Function {
    readonly kind: string;
    new(module, options): Interface;
}

export class Interface {
    static subclasses: {[key: string]: InterfaceConstructor} = {};

    static register(subclass: InterfaceConstructor): void {
        this.subclasses[subclass.kind] = subclass;
    }

    static search(kind: string): InterfaceConstructor {
        return this.subclasses[kind];
    }

    public system;
    public name: string;

    constructor(public module, public options) {
        this.system = this.module.system;
        return;
    }

    load(ifc) {
        this.name = ifc.name;
    }

    connect() {
    }
}

export class AvalonMaster extends Interface {
    static kind = "avalon_master";
    public slaves = [];

    load(ifc) {
        var blk, i, len, ref, ref1, s;
        this.slaves = [];
        ref = ifc.memoryBlock;
        for (i = 0, len = ref.length; i < len; i++) {
            blk = ref[i];
            s = {
                bridge: ((ref1 = blk.isBridge) != null ? ref1[0] : void 0) === "true",
                module: blk.moduleName[0],
                "interface": blk.slaveName[0],
                link: null,
                base: parseInt(blk.baseAddress[0]),
                size: parseInt(blk.span[0])
            };
            s.end = s.base + s.size;
            this.slaves.push(s);
        }
        this.slaves.sort((a, b) => a.base - b.base);
        return Interface.prototype.load.call(this, ifc);
    }

    connect() {
        var i, len, ref, s, target;
        ref = this.slaves;
        for (i = 0, len = ref.length; i < len; i++) {
            s = ref[i];
            target = this.module.system.modules[s.module];
            this.options.printInfo(("Connecting: " + this.module.path + "." + this.name) + (" => " + target.path + "." + s["interface"]), 3);
            s.link = target != null ? target.interfaces[s["interface"]] : void 0;
            if (s.link == null) {
                throw Error("No target slave (" + s.module + "." + s["interface"] + ") in this system");
            }
            s.link.master.link = this;
        }
    }

    getSlave(addr) {
        var btm, mid, s, top;
        top = 0;
        btm = this.slaves.length;
        while (top < btm) {
            mid = (top + btm) >>> 1;
            s = this.slaves[mid];
            if (addr < s.base) {
                btm = mid;
            } else if (addr >= s.end) {
                top = mid + 1;
            } else {
                return s;
            }
        }
    }

    read8(addr: number, count: number) {
        var s;
        s = this.getSlave(addr);
        return s != null ? s.link.read8((addr - s.base) >> 0, count) : void 0;
    }

    read16(addr: number, count: number) {
        var s;
        s = this.getSlave(addr);
        return s != null ? s.link.read16((addr - s.base) >> 1, count) : void 0;
    }

    read32(addr: number, count: number) {
        var s;
        s = this.getSlave(addr);
        return s != null ? s.link.read32((addr - s.base) >> 2, count) : void 0;
    }

    write8(addr: number, array) {
        var s;
        s = this.getSlave(addr);
        return s != null ? s.link.write8((addr - s.base) >> 0, array) : void 0;
    }

    write16(addr: number, array) {
        var s;
        s = this.getSlave(addr);
        return s != null ? s.link.write16((addr - s.base) >> 1, array) : void 0;
    }

    write32(addr: number, array) {
        var s;
        s = this.getSlave(addr);
        return s != null ? s.link.write32((addr - s.base) >> 2, array) : void 0;
    }
}
Interface.register(AvalonMaster);

export class AvalonSlave extends Interface {
    /*constructor(module, options) {
        super(module, options);
    }*/

    static kind = "avalon_slave";
    public master;

    load(ifc) {
        this.master = {
            link: null
        };
        return Interface.prototype.load.call(this, ifc);
    }

    read8(offset: number, count: number): Int8Array | Promise<Int8Array> {
        var boff, cnt32, i32, off32;
        boff = offset & 3;
        off32 = offset >>> 2;
        cnt32 = (boff + count + 3) >>> 2;
        i32 = this.read32(off32, cnt32);
        if (i32 == null) {
            return;
        }
        if (i32.then != null) {
            return i32.then((function (_this) {
                return function (_i32) {
                    return new Int8Array(_i32.buffer, _i32.byteOffset + boff, count);
                };
            })(this));
        }
        return new Int8Array(i32.buffer, i32.byteOffset + boff, count);
    }

    read16(offset: number, count: number): Int16Array | Promise<Int16Array> {
        var cnt32, i32, off32, woff;
        woff = offset & 1;
        off32 = offset >> 1;
        cnt32 = (woff + count + 1) >> 1;
        i32 = this.read32(off32, cnt32);
        if (i32 == null) {
            return;
        }
        if (i32.then != null) {
            return i32.then((function (_this) {
                return function (_i32) {
                    return new Int16Array(_i32.buffer, _i32.byteOffset + woff * 2, count * 2);
                };
            })(this));
        }
        return new Int16Array(i32.buffer, i32.byteOffset + woff * 2, count * 2);
    }

    read32(offset: number, count: number): Int32Array | Promise<Int32Array> {
        throw new Error("Not implemented");
    }

    write8(offset: number, array) {
        var u8;
        u8 = this.read8(offset, array.length);
        if (u8 == null) {
            return false;
        }
        if (u8.then != null) {
            throw Error("Asynchronous writer (write8) is not defined");
        }
        u8.set(array);
        return true;
    }

    write16(offset: number, array) {
        var u16;
        u16 = this.read16(offset, array.length);
        if (u16 == null) {
            return false;
        }
        if (u16.then != null) {
            throw Error("Asynchronous writer (write16) is not defined");
        }
        u16.set(array);
        return true;
    }

    write32(offset: number, array) {
        var i32;
        i32 = this.read32(offset, array.length);
        if (i32 == null) {
            return false;
        }
        if (i32.then != null) {
            throw Error("Asynchronous writer (write32) is not defined");
        }
        i32.set(array);
        return true;
    }
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

export class InterruptSender extends Interface {
    static kind = "interrupt_sender";
}
Interface.register(InterruptSender);

export class NiosCustomInstructionMaster extends Interface {
    static kind = "nios_custom_instruction_master";
}
Interface.register(NiosCustomInstructionMaster);

export class ResetSink extends Interface {
    static kind = "reset_sink";
}
Interface.register(ResetSink);

export class ResetSource extends Interface {
    static kind = "reset_source";
}
Interface.register(ResetSource);
