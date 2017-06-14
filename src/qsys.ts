import * as dedent from "dedent";
import { parseString } from "xml2js";
import { Module } from "./module";
import { IpCatalog } from "./ipcatalog";
import { SopcInfo } from "./sopcinfo";

const BARE_RAM_BASE = 0x00001000;
const BARE_RAM_SIZE = 0x10000000 - BARE_RAM_BASE;

export class Qsys {
    public modules = {};
    public info;

    constructor(public options) {
    }

    create(image) {
        return this.load(dedent`
        <?xml version="1.0" encoding="UTF-8"?>
        <EnsembleReport name="default_system" kind="default_system" fabric="QSYS">
            <parameter name="SYSTEM_FOR_SIMULATOR">
                <type>boolean</type>
                <value>true</value>
                <derived>false</derived>
                <enabled>true</enabled>
                <visible>false</visible>
                <valid>true</valid>
            </parameter>
            <module name="cpu" kind="altera_nios2_gen2" path="cpu">
                <assignment>
                    <name>embeddedsw.CMacro.HARDWARE_DIVIDE_PRESENT</name>
                    <value>0</value>
                    </assignment>
                <assignment>
                    <name>embeddedsw.CMacro.HARDWARE_MULTIPLY_PRESENT</name>
                    <value>1</value>
                </assignment>
                <assignment>
                    <name>embeddedsw.CMacro.HARDWARE_MULX_PRESENT</name>
                    <value>0</value>
                </assignment>
                <assignment>
                    <name>embeddedsw.CMacro.RESET_ADDR</name>
                    <value>${image.entry}</value>
                </assignment>
                <interface name="data_master" kind="avalon_master">
                    <memoryBlock>
                        <isBridge>false</isBridge>
                        <moduleName>ram</moduleName>
                        <slaveName>s1</slaveName>
                        <name>ram.s1</name>
                        <baseAddress>${BARE_RAM_BASE}</baseAddress>
                        <span>${BARE_RAM_SIZE}</span>
                    </memoryBlock>
                </interface>
                <interface name="instruction_master" kind="avalon_master">
                    <memoryBlock>
                        <isBridge>false</isBridge>
                        <moduleName>ram</moduleName>
                        <slaveName>s1</slaveName>
                        <name>ram.s1</name>
                        <baseAddress>${BARE_RAM_BASE}</baseAddress>
                        <span>${BARE_RAM_SIZE}</span>
                    </memoryBlock>
                </interface>
            </module>
            <module name="ram" kind="altera_avalon_new_sdram_controller" path="ram">
                <interface name="s1" kind="avalon_slave">
                    <assignment>
                        <name>embeddedsw.configuration.isMemoryDevice</name>
                        <value>1</value>
                    </assignment>
                </interface>
            </module>
        </EnsembleReport>
        `);
    }

    load(xml) {
        return Promise.resolve().then(() => {
            return SopcInfo.parse(xml);
        })
        .then((info) => {
            this.info = info;
            if (this.info.fabric !== "QSYS") {
                return Promise.reject(Error("Invalid .sopcinfo file"));
            }
            let cat = new IpCatalog(this.options);
            let names = Object.keys(this.info.module);
            return names.reduce((promise, name) => {
                return promise
                .then(() => {
                    var cls, m, mod;
                    m = this.info.module[name];
                    this.options.printInfo("Adding module: " + m.path + " (" + m.kind + ")", 2);
                    cls = cat.search(m.kind);
                    if (cls == null) {
                        throw Error("No emulator for " + m.kind + " module");
                    }
                    mod = new cls(m.path, this, this.options);
                    this.modules[m.path] = mod;
                    return mod.load(m);
                });
            }, Promise.resolve());
        })
        .then(() => {
            let names = Object.keys(this.modules);
            this.options.printInfo("Connecting modules");
            return names.reduce((promise, name) => {
                return promise
                .then(() => {
                    return this.modules[name].connect();
                });
            }, Promise.resolve());
        });
    }

    loadImage(image) {
        var cpu;
        cpu = null;
        return Promise.resolve()
        .then(() => {
            var c, cpu_name, n, ref, ref1, ref2, ref3, ref4;
            cpu_name = (ref = image.body) != null ? (ref1 = ref.sections.find(function (s) {
                return s.name === ".cpu";
            })) != null ? ref1.data.toString() : void 0 : void 0;
            if (cpu_name != null) {
                cpu = this.modules[cpu_name];
                if (!(cpu != null ? cpu.isProcessor : void 0)) {
                    throw Error("Processor \"" + cpu_name + "\" is not found in this system");
                }
            } else {
                ref2 = this.modules;
                for (n in ref2) {
                    c = ref2[n];
                    if (c.isProcessor) {
                        cpu = c;
                        break;
                    }
                }
                if (cpu == null) {
                    throw Error("No processor detected in this system");
                }
                this.options.printWarn("No processor specified. Use \"" + cpu.name + "\"");
            }
            this.options.printInfo("Deploying executable image through processor \"" + cpu.name + "\"", 1);
            return ((ref3 = (ref4 = image.body) != null ? ref4.programs : void 0) != null ? ref3 : []).reduce(function (promise, p) {
                if (!(p.type === "load" || p.type === "lz4-load")) {
                    return promise;
                }
                return promise.then(function () {
                    var ba, ea, hex8, zs;
                    ba = p.paddr;
                    ea = ba + p.memsz;
                    hex8 = function (v) {
                        return ("0000000" + (v >>> 0).toString(16)).substr(-8);
                    };
                    this.options.printInfo("Writing memory 0x" + (hex8(ba)) + "-0x" + (hex8(ea - 1)), 2);
                    if (p.filesz > 0) {
                        cpu.loadProgram(ba, p.data);
                    }
                    ba += p.filesz;
                    zs = ea - ba;
                    if (zs > 0) {
                        return cpu.loadProgram(ba, Buffer.alloc(zs));
                    }
                });
            }, Promise.resolve());
        })
        .then(() => {
            cpu.resetProcessor();
        })
        .then(() => {
            return cpu.runner;
        });
    }
}
