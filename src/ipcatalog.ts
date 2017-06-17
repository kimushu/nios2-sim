import { ModuleConstructor } from "./module";
import { SimulatorOptions } from "./simulator";

export interface Nios2SimIpPlugin {
    getModuleConstructor(kind: string): ModuleConstructor;
}

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
        if ((constructor == null) && this.options.plugin) {
            try {
                let pluginName = `nios2-sim-ip-${kind.toLowerCase()}`;
                let plugin: Nios2SimIpPlugin = require(pluginName);
                constructor = plugin.getModuleConstructor(kind);
                this.options.printInfo(`Plugin loaded: ${pluginName}`);
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
import { AvalonSlave } from "./interface";

class DummyModule extends Module {
    static kind = "nios2_sim_dummy_module";

    load(moddesc: SopcInfoModule): Promise<void> {
        for (let name in moddesc.interface) {
            let i = this.loadInterface(moddesc.interface[name]);
            if (i instanceof AvalonSlave) {
                // Avalon slave of dummy module always return zero
                i.read32 = (offset: number, count?: number) => {
                    return new Int32Array((count != null) ? count : 1);
                };
            }
        }
        return Module.prototype.load.call(this, moddesc);
    }
}
