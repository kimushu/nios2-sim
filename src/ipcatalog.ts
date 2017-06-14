import { DummyModule } from "./module";

export class IpCatalog {
    static global = {};

    static register(kind: string, constructor) {
        this.global[kind] = constructor;
    }

    public local = {};

    constructor(public options) {
    }

    search(kind: string, useDummy: boolean = true) {
        let cls = this.local[kind] || IpCatalog.global[kind];
        if ((cls == null) && useDummy && this.options.ignoreUnknown) {
            this.options.printWarn("No emulator for " + kind + " found. Replaced with dummy module.");
            cls = DummyModule;
        }
        return cls;
    }
}
