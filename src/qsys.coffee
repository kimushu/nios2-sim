Promise = require("es6-promise")
{parseString} = require("xml2js")
{Component, ComponentCatalog} = require("./component")
{InterfaceCatalog} = require("./interface")

expandAssignment = (obj) ->
  # <assignment><name>xxx</name><value>yyy</value></assignment>...
  # -> {xxx: yyy, ...}
  result = {}
  for item in (obj.assignment ? [])
    name = item.name[0]
    value = item.value[0]
    result[name] ?= value if name?
  obj.assignment = result
  return

expandParameter = (obj) ->
  # <parameter name="xxx"><...elements...></parameter>...
  # -> {xxx: {<...elements...>}, ...}
  result = {}
  for item in (obj.parameter ? [])
    name = item.$.name
    item[key] = value[0] for key, value of item when key != "$"
    result[name] = item if name?
  obj.parameter = result
  return

expandInterface = (obj) ->
  # <interface name="xxx"><parameter .../><...elements...></interface>...
  # -> {xxx: {parameter: {...}, <...elements...>}, ...}
  result = {}
  for item in (obj.interface ? [])
    name = item.$.name
    expandAssignment(item)
    expandParameter(item)
    result[name] = item if name?
  obj.interface = result
  return

class Qsys
  constructor: (@options) ->
    @connections = 0
    return

  load: (xml) ->
    @components = {}
    @ifcatalog = new InterfaceCatalog(@options)
    catalog = new ComponentCatalog(@options)
    return new Promise((resolve, reject) =>
      parseString(xml, (err, result) =>
        return reject(err) if err?
        root = result.EnsembleReport
        fabric = root?.$?.fabric
        return reject(
          Error("Unsupported fabric: #{fabric}")
        ) unless fabric == "QSYS"
        resolve(root)
      ) # parseString()
    ).then((root) =>
      return root.module.reduce(
        (promise, module) =>
          {path, kind} = module.$
          return promise.then(=>
            @options.printInfo("Adding component: #{path} (#{kind})", 2)
            cls = catalog.lookup(kind)
            throw Error("No emulator for #{kind} found") unless cls?
            compo = new cls(path, this, @options)
            expandAssignment(module)
            expandParameter(module)
            expandInterface(module)
            return compo.load(module).then(=>
              @components[path] = compo
              return
            )
          )
        Promise.resolve()
      ) # return root.module.reduce()
    ).then(=>
      @options.printInfo("Connecting components", 2)
      compo.connect() for path, compo of @components
      @options.printInfo("#{@connections} connections loaded")
      return
    ) # return new Promise().then()...

  loadInterface: (compo, ifdesc) ->
    kind = ifdesc.$.kind
    cls = @ifcatalog.lookup(kind)
    throw Error("No interface support for \"#{kind}\"") unless cls?
    result = new cls(compo, ifdesc, @options)
    result.load(ifdesc)
    return result

  deployImage: (image) ->
    cpu_name = image.body?.sections.find(
      (s) => s.name == ".cpu"
    )?.data.toString()
    if cpu_name?
      cpu = @components[cpu_name]
      throw Error(
        "Processor \"#{cpu_name}\" is not found in this system"
      ) unless cpu?.isProcessor
    else
      for n, c of @components
        if c.isProcessor 
          cpu = c
          break
      throw Error("No processor detected in this system") unless cpu?
      @options.printWarn("No processor specified. Use \"#{cpu.name}\"")
    @options.printInfo("Deploying executable image through processor \"#{cpu.name}\"", 1)
    for p in image.body?.programs
      continue if p.leng
      if p.type == "load" or p.type == "lz4-load"
        ba = p.paddr
        ea = ba + p.memsz
        hex8 = (v) -> ("0000000" + (v >>> 0).toString(16)).substr(-8)
        @options.printInfo("Writing memory 0x#{hex8(ba)}-0x#{hex8(ea-1)}", 2)
        cpu.deploy(ba, p.data) if p.filesz > 0
        ba += p.filesz
        zs = ea - ba
        cpu.deploy(ba, Buffer.alloc(zs)) if zs > 0
    cpu.cpu_reset()
    run = =>
      Promise.resolve(
      ).then(=>
        cpu.cpu_work()
      ).then(=>
        run()
      )
    return run()

module.exports = {Qsys}
