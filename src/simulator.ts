import * as fs from "fs";
import * as colors from "colors";
import { Qsys } from "./qsys";

export interface SimulatorOptions {
    sopcinfo: string;
    ignoreUnknown: boolean;
    cpuTrace: boolean;
    plugin: boolean;
    breakJs: number[];
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

export class Simulator {
    public system: Qsys;
    public options: SimulatorOptions;
    public image: ElfImage;

    constructor() {
    }

    run(argv: string[]) {
        return Promise.resolve().then(() => {
            return this.parseOptions(argv);
        })
        .then(() => {
            return this.loadExecutable(this.options.args[0]);
        })
        .then(() => {
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
                this.system.cpu.runProcessor()
                .then(() => {
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
        .option("--break-js <addr>", "Set JS breakpoint", (v, t) => {
            t.push(parseInt(v));
            return t;
        }, [])
        .option("-v, --verbose", "Increase verbosity", (v, t) => (t + 1), 0)
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
