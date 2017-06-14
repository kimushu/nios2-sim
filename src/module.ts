import { Interface } from "./interface";

export class Module {
    public name;
    public interfaces = [];

    static register(subclass) {
        IpCatalog.register(subclass.kind, subclass);
    }

    constructor(public path, public system, public options) {
    }

    load(module) {
        this.name = module.name;
    }

    connect() {
        for (let name in this.interfaces) {
            this.interfaces[name].connect();
        }
    }

    loadInterface(ifc) {
        let cls = Interface.search(ifc.kind);
        if (cls == null) {
            throw Error("No emulator for #{ifc.kind} interface");
        }
        let inst = new cls(this, this.options);
        this.interfaces[ifc.name] = inst;
        inst.load(ifc);
        return inst;
    }
}

export class DummyModule extends Module {
    load(module) {
        for (let name in module.interfaces) {
            this.loadInterface(module.interfaces[name]);
        }
        return Module.prototype.load.call(this, module);
    }
}

import { IpCatalog } from "./ipcatalog";

require("./alt_bridge");
require("./alt_clock");
require("./alt_memory");
require("./alt_peripheral");
require("./alt_processor");
require("./alt_serial");
