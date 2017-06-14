import { ModuleConstructor } from "./module";
import { SimulatorOptions } from "./simulator";

interface ModuleConstructorSet {
    [kind: string]: ModuleConstructor;
}

export class IpCatalog {
    private static global: ModuleConstructorSet = {};

    static register(kind: string, constructor: ModuleConstructor): void {
        this.global[kind] = constructor;
    }

    private local: ModuleConstructorSet = {};

    constructor(public options: SimulatorOptions) {
    }

    search(kind: string, useDummy: boolean = true): ModuleConstructor {
        let constructor = this.local[kind] || IpCatalog.global[kind];
        if ((constructor == null) && !this.options.noPlugin) {
            try {
                let plugin = require(`nios2-sim-ip-${kind.toLowerCase()}`);
                constructor = plugin.getConstructor(kind);
            } catch (error) {
                // Ignore error
            }
        }
        if ((constructor == null) && useDummy && this.options.ignoreUnknown) {
            this.options.printWarn(`No emulator for ${kind} found. Replaced with dummy module.`);
            constructor = DummyModule;
        }
        return constructor;
    }
}

import { Module } from "./module";
import { SopcInfoModule } from "./sopcinfo";

class DummyModule extends Module {
    static kind = "nios2_sim_dummy_module";

    load(moddesc: SopcInfoModule): Promise<void> {
        for (let name in moddesc.interface) {
            this.loadInterface(moddesc.interface[name]);
        }
        return Module.prototype.load.call(this, moddesc);
    }
}
