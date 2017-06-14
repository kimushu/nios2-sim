import { Module } from "./module";

class AlteraAvalonUART extends Module {
    static kind = "altera_avalon_uart";

    load(module) {
        this.loadInterface(module["interface"].s1);
        return Module.prototype.load.call(this, module);
    }
}
Module.register(AlteraAvalonUART);
