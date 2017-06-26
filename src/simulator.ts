import * as fs from "fs";
import * as colors from "colors";
import { Qsys } from "./qsys";

/**
 * Maximum steps executed in one Node.js tick cycle
 */
const STEPS_PER_TICK = 256;

export interface AddressSpec {
    name?: string;
    value: number;
}

export interface BreakpointSpec extends AddressSpec {
}

export interface EmptyFuncSpec extends AddressSpec {
    result: number;
}

export interface SimulatorOptions {
    sopcinfo: string;
    ignoreUnknown: boolean;
    cpuTrace: boolean;
    plugin: boolean;
    breakJs: BreakpointSpec[];
    emptyFunc: EmptyFuncSpec[];
    verbose: number;
    args: string[];
    printInfo: (message: string, verbosity?: number) => void;
    printWarn: (message: string, verbosity?: number) => void;
    printErr: (message: string, verbosity?: number) => void;
}

export interface ElfImage {
    class: string;
    endian: string;
    version: number;
    osabi: string;
    abiversion: string;
    type: string;
    machine: string;
    entry: number;
    phoff: number;
    shoff: number;
    flags: number;
    ehsize: number;
    phentsize: number;
    phnum: number;
    shentsize: number;
    shnum: number;
    shstrndx: number;
    body: {
        programs: {
            type: string;
            offset: number;
            vaddr: number;
            paddr: number;
            filesz: number;
            memsz: number;
            flags: any;
            align: number;
            data: Buffer;
        }[];
        sections: {
            name: string;
            type: string;
            flags: any;
            addr: number;
            off: number;
            size: number;
            link: number;
            info: number;
            addralign: number;
            entsize: number;
            data: Buffer;
        }[];
    };
}

export interface ElfSymbol {
    name: string;
    value: number;
    data?: boolean;
    func?: boolean;
}

/**
 * NiosII simulator class
 */
export class Simulator {
    /** System (Qsys) */
    public system: Qsys;

    /** Simulator options */
    public options: SimulatorOptions;

    /** Loaded program image */
    public image: ElfImage;

    /** Loaded symbols */
    public symbols: ElfSymbol[];

    /**
     * Construct instance
     */
    constructor() {
    }

    /**
     * Run simulator
     * @param argv arguments
     */
    run(argv: string[]) {
        return Promise.resolve().then(() => {
            this.parseOptions(argv);
            this.loadExecutable(this.options.args[0]);
            this.loadSymbols();
            this.resolveSymbols();
            return this.loadSystem();
        })
        .then(() => {
            return this.system.loadImage(this.image);
        })
        .then(() => {
            return this.system.cpu.resetProcessor();
        })
        .then(() => {
            let run = () => {
                return this.system.cpu.runProcessor(STEPS_PER_TICK)
                .then((value) => {
                    return run();
                });
            };
            return run();
        })
        .then(() => {
            return process.exit(0);
        })
        .catch((reason) => {
            process.stderr.write((colors.red(reason.stack)) + "\n");
            return process.exit(1);
        });
    }

    parseOptions(argv: string[]): void {
        const program = require("commander");
        program.printInfo = function (msg: string, verbosity: number = 0) {
            if (verbosity <= this.verbose) {
                process.stderr.write(colors.cyan(`Info: ${msg}\n`));
            }
        };
        program.printErr = function (msg: string, verbosity: number = 0) {
            if (verbosity <= this.verbose) {
                process.stderr.write(colors.red(`Error: ${msg}\n`));
            }
        };
        program.printWarn = function (msg: string, verbosity: number = 0) {
            if (verbosity <= this.verbose) {
                process.stderr.write(colors.yellow(`Warning: ${msg}\n`));
            }
        };
        program
        .usage("[options] <file>")
        .description("Altera NiosII program simulator")
        .option("-s, --sopcinfo <sopcinfo>", "Specify .sopcinfo file")
        .option("--ignore-unknown", "Ignore unknown components")
        .option("--cpu-trace", "Show CPU trace")
        .option("--no-plugin", "Disable plugins")
        .option("--break-js <addr>", "Set JS breakpoint", (v: string, t: BreakpointSpec[]) => {
            if (v.match(/^\d/)) {
                t.push({ value: parseInt(v) });
            } else {
                t.push({ name: v, value: null });
            }
            return t;
        }, [])
        .option("--empty-func <addr>[:<result>]", "Empty function", (v: string, t: EmptyFuncSpec[]) => {
            let [ n, r ] = v.split(":", 2);
            if (n.match(/^\d/)) {
                t.push({ value: parseInt(n), result: (r != null) ? parseInt(r) : null });
            } else {
                t.push({ name: n, value: null, result: (r != null) ? parseInt(r) : null });
            }
            return t;
        }, [])
        .option("-v, --verbose", "Increase verbosity", (v: any, t: number) => (t + 1), 0)
        .parse(argv);
        if (program.args.length === 0) {
            program.printErr("No executable specified");
            program.outputHelp();
            process.exit(1);
        }
        if (program.args.length > 1) {
            program.printErr("Only one executable can be specified");
            program.outputHelp();
            process.exit(1);
        }
        if (program.verbose == null) {
            program.verbose = 0;
        }
        this.options = program;
    }

    loadExecutable(exec: string): void {
        this.options.printInfo(`Loading executable: ${exec}`, 1);
        const elfy = require("elfy");
        elfy.constants.machine[113] = "altera_nios2";
        elfy.constants.entryType[0x63700101] = "lz4-load";
        this.image = elfy.parse(fs.readFileSync(exec));
    }

    loadSymbols(): void {
        this.symbols = [];
        let strtab: Uint8Array = (this.image.body.sections.find((s) => s.name === ".strtab") || <any>{}).data;
        let symtab = Buffer.from((this.image.body.sections.find((s) => s.name === ".symtab") || <any>{}).data || []);
        for (let i = 0; i < symtab.length; i += 16) {
            let st_name  = symtab.readUInt32LE(i + 0);
            let st_value = symtab.readUInt32LE(i + 4);
            let st_size  = symtab.readUInt32LE(i + 8);
            let st_info  = symtab.readUInt8(i + 12);
            let st_other = symtab.readUInt8(i + 13);
            let st_shndx = symtab.readUInt16LE(i + 14);
            let nulIndex = strtab.indexOf(0, st_name);
            let name = String.fromCharCode.apply(null, strtab.subarray(st_name, nulIndex));
            let sym: ElfSymbol = { name, value: st_value };
            switch (st_info & 0xf) {
                case 1: // STT_OBJECT
                    sym.data = true;
                    this.symbols.push(sym);
                    break;
                case 2: // STT_FUNC
                    sym.func = true;
                    this.symbols.push(sym);
                    break;
            }
        }
    }

    resolveSymbols(): void {
        for (let brk of this.options.breakJs) {
            if (brk.name != null) {
                brk.value = this.symbols.find((sym) => sym.func && sym.name === brk.name).value;
            }
        }
        for (let emp of this.options.emptyFunc) {
            if (emp.name != null) {
                emp.value = this.symbols.find((sym) => sym.func && sym.name === emp.name).value;
            }
        }
    }

    loadSystem(): Promise<void> {
        let xml: Buffer;
        let path = this.options.sopcinfo;
        if (path != null) {
            this.options.printInfo(`Loading system: ${path}`, 1);
            xml = fs.readFileSync(path);
        } else {
            let section = this.image.body.sections.find((section) => section.name === ".sopcinfo");
            if (section != null) {
                if (this.options.sopcinfo != null) {
                    this.options.printWarn("sopcinfo embedded ELF image is ignored");
                }
                xml = section.data;
                this.options.printInfo("Loading system: (sopcinfo attached in executable)", 1);
            }
        }
        this.system = new Qsys(this.options);
        if (xml == null) {
            this.options.printWarn("No sopcinfo loaded");
            return this.system.create(this.image);
        }
        return this.system.load(xml);
    }
}
