import { Module } from "./module";

class AlteraAvalonTimer extends Module {
    static kind = "altera_avalon_timer";

    load(module) {
        this.loadInterface(module["interface"].s1);
        return Module.prototype.load.call(this, module);
    }
}
Module.register(AlteraAvalonTimer);
