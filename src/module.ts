import { Interface } from "./interface";
import { Qsys } from "./qsys";
import { SimulatorOptions } from "./simulator";
import { SopcInfoInterface, SopcInfoModule } from "./sopcinfo";

export interface ModuleConstructor extends Function {
    readonly kind: string;
    new (path: string, system: Qsys, options: SimulatorOptions): Module;
}

export class Module {
    public name: string;
    public interfaces: {[name: string]: Interface} = {};

    static register(subclass: ModuleConstructor): void {
        IpCatalog.register(subclass.kind, subclass);
    }

    constructor(public path: string, public system: Qsys, public options: SimulatorOptions) {
    }

    load(moddesc: SopcInfoModule): Promise<void> {
        this.name = moddesc.name;
        return Promise.resolve();
    }

    connect(): void {
        for (let name in this.interfaces) {
            this.interfaces[name].connect();
        }
    }

    loadInterface(ifdesc: SopcInfoInterface): Interface {
        let cls = Interface.search(ifdesc.kind);
        if (cls == null) {
            throw Error(`No emulator for ${ifdesc.kind} interface`);
        }
        let inst = new cls(this, this.options);
        this.interfaces[ifdesc.name] = inst;
        inst.load(ifdesc);
        return inst;
    }
}

export interface ProcessorTimer {
    /**
     * Clear timer
     */
    clear: () => void;
}

export class ProcessorModule extends Module {
    /** Cycle counter (approx.) */
    public cycles: number;

    /** Clock rate (in Hz) */
    get clockRate(): number {
        throw new Error("pure function");
    }

    loadProgram(addr: number, data: Buffer): Promise<void> {
        return Promise.reject(new Error("pure function"));
    }
    resetProcessor(): void {
        throw new Error("pure function");
    }
    runProcessor(steps?: number): Promise<number> {
        return Promise.reject(new Error("pure function"));
    }
    addTimer(cycles: number, listener: Function): ProcessorTimer {
        throw new Error("pure function");
    }
}

import { IpCatalog } from "./ipcatalog";

require("./alt_bridge");
require("./alt_clock");
require("./alt_memory");
require("./alt_peripheral");
require("./alt_processor");
require("./alt_fpu");
require("./alt_serial");
