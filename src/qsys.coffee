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
      return
    ) # return new Promise().then()...

  createInterface: (compo, ifdesc) ->
    kind = ifdesc.$.kind
    cls = @ifcatalog.lookup(kind)
    throw Error("No interface support for \"#{kind}\"") unless cls?
    return new cls(compo)

class QsysInterface
  null

module.exports = {Qsys, QsysInterface}
