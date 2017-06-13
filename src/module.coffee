# Base class for all modules

{Interface} = require("./interface")

Module = class exports.Module
  @register: (subclass) ->
    IpCatalog.register(subclass.kind, subclass)
    return

  constructor: (@path, @system, @options) ->
    @interfaces = {}
    return

  load: (module) ->
    @name = module.name
    return

  connect: ->
    i.connect() for name, i of @interfaces
    return

  loadInterface: (ifc) ->
    cls = Interface.search(ifc.kind)
    throw Error("No emulator for #{ifc.kind} interface") unless cls?
    inst = new cls(this, @options)
    @interfaces[ifc.name] = inst
    inst.load(ifc)
    return inst

class exports.DummyModule extends Module
  load: (module) ->
    @loadInterface(ifc) for name, ifc of module.interface
    return super

{IpCatalog} = require("./ipcatalog")

require("./alt_bridge")
require("./alt_clock")
require("./alt_memory")
require("./alt_peripheral")
require("./alt_processor")
require("./alt_serial")
