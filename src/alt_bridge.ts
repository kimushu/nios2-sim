import { Module } from "./module";

class AlteraAvalonMMBridge extends Module {
    static kind = "altera_avalon_mm_bridge";

    load(module) {
        var i;
        i = module["interface"];
        this.loadInterface(i.s0);
        this.loadInterface(i.m0);
        return Module.prototype.load.call(this, module);
    }
}
Module.register(AlteraAvalonMMBridge);
