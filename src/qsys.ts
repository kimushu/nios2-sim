import * as dedent from "dedent";
import { parseString } from "xml2js";
import { Module, ProcessorModule } from "./module";
import { IpCatalog } from "./ipcatalog";
import { SopcInfo, SopcInfoRoot } from "./sopcinfo";
import { ElfImage, SimulatorOptions } from "./simulator";
import { hex8p } from "./sprintf";

const BARE_RAM_BASE = 0x00001000;
const BARE_RAM_SIZE = 0x10000000 - BARE_RAM_BASE;

export class Qsys {
    public modules: {[path: string]: Module} = {};
    public root: SopcInfoRoot;
    public cpu: ProcessorModule;

    constructor(public options: SimulatorOptions) {
    }

    create(image: ElfImage): Promise<void> {
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
                <parameter name="size">
                    <value>${BARE_RAM_SIZE}</value>
                </parameter>
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

    load(xml: Buffer): Promise<void> {
        return Promise.resolve().then(() => {
            return SopcInfo.parse(xml);
        })
        .then((root) => {
            this.root = root;
            if (this.root.fabric !== "QSYS") {
                throw new Error("Invalid .sopcinfo file");
            }
            let cat = new IpCatalog(this.options);
            let names = Object.keys(this.root.module);
            return names.reduce((promise, name) => {
                return promise
                .then(() => {
                    var cls, mod;
                    let moddesc = this.root.module[name];
                    this.options.printInfo(`Adding module: ${moddesc.path} (${moddesc.kind})`, 2);
                    cls = cat.search(moddesc.kind);
                    if (cls == null) {
                        throw Error(`No emulator for ${moddesc.kind} module`);
                    }
                    mod = new cls(moddesc.path, this, this.options);
                    this.modules[moddesc.path] = mod;
                    return mod.load(moddesc);
                });
            }, Promise.resolve());
        })
        .then(() => {
            let paths = Object.keys(this.modules);
            this.options.printInfo("Connecting modules", 1);
            return paths.reduce((promise, path) => {
                return promise
                .then(() => this.modules[path].connect());
            }, Promise.resolve());
        });
    }

    loadImage(image: ElfImage): Promise<void> {
        return Promise.resolve()
        .then(() => {
            let section = image.body.sections.find((section) => (section.name === ".cpu"));
            let cpu_path = (section != null) ? section.data.toString() : null;
            if (cpu_path != null) {
                let mod = this.modules[cpu_path];
                if (!(mod instanceof ProcessorModule)) {
                    throw Error(`Processor "${cpu_path}" is not found in this system`);
                }
                this.cpu = mod;
            } else {
                for (let path of Object.keys(this.modules)) {
                    let mod = this.modules[path];
                    if (mod instanceof ProcessorModule) {
                        this.cpu = mod;
                        break;
                    }
                }
                if (this.cpu == null) {
                    throw Error("No processor detected in this system");
                }
                this.options.printWarn(`No processor specified. Use "${this.cpu.name}"`);
            }
            this.options.printInfo(`Deploying executable image through processor "${this.cpu.name}"`, 1);
            return image.body.programs.reduce((promise, p) => {
                if (!(p.type === "load" || p.type === "lz4-load")) {
                    return promise;
                }
                if (p.vaddr === 0) {
                    return promise;
                }
                return promise
                .then(() => {
                    let ba = p.paddr;
                    let ea = ba + p.memsz;
                    this.options.printInfo(`Writing memory ${hex8p(ba)}-${hex8p(ea - 1)}`, 2);
                    if (p.filesz > 0) {
                        this.cpu.loadProgram(ba, p.data);
                    }
                    ba += p.filesz;
                    let zs = ea - ba;
                    if (zs > 0) {
                        return this.cpu.loadProgram(ba, Buffer.alloc(zs));
                    }
                });
            }, Promise.resolve());
        });
    }
}
