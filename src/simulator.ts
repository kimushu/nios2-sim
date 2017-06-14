import * as fs from "fs";
import * as colors from "colors";
import { Qsys } from "./qsys";

function printErr(msg: string) {
    return process.stderr.write(colors.red("Error: " + msg) + "\n");
}

function printWarn(msg: string) {
    return process.stderr.write(colors.yellow("Warning: " + msg) + "\n");
}

export class Simulator {
    constructor() {
    }

    run(argv: string[]) {
        var image, options, system;
        options = null;
        image = null;
        system = null;
        return Promise.resolve().then(() => {
            return this.parseOptions(argv);
        })
        .then((result) => {
            options = result;
            return this.loadExecutable(options.args[0], options);
        })
        .then((result) => {
            image = result;
            return this.loadSystem(image, options);
        })
        .then((result) => {
            system = result;
            return system.loadImage(image);
        })
        .then(() => {
            return process.exit(0);
        })
        .catch((reason) => {
            process.stderr.write((colors.red(reason.stack)) + "\n");
            return process.exit(1);
        });
    }

    parseOptions(argv: string[]) {
        const program = require("commander");
        program.printInfo = function (msg, verbosity) {
            if (verbosity == null) {
                verbosity = 0;
            }
            if (verbosity > this.verbose) {
                return;
            }
            process.stderr.write(colors.cyan("Info: " + msg + "\n"));
        };
        program.printErr = function (msg, verbosity) {
            if (verbosity == null) {
                verbosity = 0;
            }
            if (verbosity > this.verbose) {
                return;
            }
            process.stderr.write(colors.red("Error: " + msg + "\n"));
        };
        program.printWarn = function (msg, verbosity) {
            if (verbosity == null) {
                verbosity = 0;
            }
            if (verbosity > this.verbose) {
                return;
            }
            process.stderr.write(colors.yellow("Warning: " + msg + "\n"));
        };
        program
        .usage("[options] <file>")
        .description("Altera NiosII program simulator")
        .option("-s, --sopcinfo <sopcinfo>", "Specify .sopcinfo file")
        .option("--ignore-unknown", "Ignore unknown components")
        .option("--cpu-trace", "Show CPU trace")
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
        return program;
    }

    loadExecutable(exec, options) {
        options.printInfo("Loading executable: " + exec, 1);
        const elfy = require("elfy");
        elfy.constants.machine[113] = "altera_nios2";
        elfy.constants.entryType[0x63700101] = "lz4-load";
        return elfy.parse(fs.readFileSync(exec));
    }

    loadSystem(image, options) {
        let path, ref, section, system, xml;
        path = options.sopcinfo;
        if (path != null) {
            options.printInfo("Loading system: " + path, 1);
            xml = fs.readFileSync(path);
        }
        if (image.body != null) {
            section = image.body.find((section) => section.name === ".sopcinfo");
        }
        if (section != null) {
            if (options.sopcinfo != null) {
                printWarn("sopcinfo embedded ELF image is ignored");
            }
            xml = section.data;
            options.printInfo("Loading system: (sopcinfo attached in executable)", 1);
        }
        system = new Qsys(options);
        if (xml == null) {
            printWarn("No sopcinfo loaded");
            return system.create(image).then(() => system);
        }
        return system.load(xml).then(() => system);
    }
}
