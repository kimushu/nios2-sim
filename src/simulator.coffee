fs = require("fs")
colors = require("colors")
Promise = require("es6-promise")

{Qsys} = require("./qsys")

printErr = (msg) ->
  process.stderr.write(colors.red("Error: #{msg}") + "\n")
printWarn = (msg) ->
  process.stderr.write(colors.yellow("Warning: #{msg}") + "\n")

class Simulator
  run: (argv) ->
    options = null
    image = null
    system = null
    return Promise.resolve(
    ).then(=>
      # Parse options
      return @parseOptions(argv)
    ).then((result) =>
      options = result
      # Load executable
      exec = options.args[0]
      return @loadExecutable(exec, options)
    ).then((result) =>
      image = result
      # Load sopcinfo
      return @loadSystem(image, options)
    ).then((result) =>
      system = result
    ).then(=>
      # Exit successfully
      process.exit(0)
    ).catch((reason) =>
      options.printErr(reason)
      process.exit(1)
    )
    return

  parseOptions: (argv) ->
    program = require("commander")

    program.printInfo = (msg, verbosity = 0) ->
      return if verbosity > @verbose
      process.stderr.write(colors.cyan("Info: #{msg}\n"))
      return
    program.printErr = (msg, verbosity = 0) ->
      return if verbosity > @verbose
      process.stderr.write(colors.red("Error: #{msg}\n"))
      return
    program.printWarn = (msg, verbosity = 0) ->
      return if verbosity > @verbose
      process.stderr.write(colors.yellow("Warning: #{msg}\n"))
      return

    program
      .usage("[options] <file>")
      .description("Altera NiosII program simulator")
      .option("-s, --sopcinfo <sopcinfo>", "Specify .sopcinfo file")
      .option("--ignore-unknown", "Ignore unknown components")
      .option("-v, --verbose", "Increase verbosity", ((v, t) -> (t + 1)), 0)
      .parse(argv)

    if program.args.length == 0
      program.printErr("No executable specified")
      program.outputHelp()
      process.exit(1)

    if program.args.length > 1
      program.printErr("Only one executable can be specified")
      program.outputHelp()
      process.exit(1)

    return program

  loadExecutable: (exec, options) ->
    options.printInfo("Loading executable: #{exec}", 1)
    elfy = require("elfy")
    elfy.constants.machine[113] ?= "altera_nios2"
    return elfy.parse(fs.readFileSync(exec))

  loadSystem: (image, options) ->
    path = options.sopcinfo
    if path?
      options.printInfo("Loading system: #{path}", 1)
      xml = fs.readFileSync(path)
    for section in image.body?.sections or []
      continue unless section.name == ".sopcinfo"
      if options.sopcinfo?
        printWarn("sopcinfo embedded ELF image is ignored")
      xml = section.data
      options.printInfo("Loading system: (sopcinfo attached in executable)", 1)
      break
    system = new Qsys(options)
    unless xml?
      printWarn("No sopcinfo loaded")
      return system.create().then(=>
        return system
      )
    return system.load(xml).then(=>
      return system
    )

module.exports = {Simulator}
