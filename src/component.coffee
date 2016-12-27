class Component
  @catalog: {}

  @register: (subclass) ->
    @catalog[subclass.kind] = subclass
    return

  constructor: (@path, @system, @options) ->
    @interfaces = {}
    return

  load: (module) ->
    @name = module.$.name
    return Promise.resolve()

  connect: ->
    return

  loadInterface: (ifdesc) ->
    i = @system.loadInterface(this, ifdesc)
    @interfaces[i.name] = i
    return i

class ComponentCatalog
  constructor: (@options) ->
    return

  lookup: (kind) ->
    cls = Component.catalog[kind]
    if !cls? and @options.ignoreUnknown
      @options.printWarn("No emulator for #{kind} found. Replaced with dummy component.")
      cls = DummyComponent
    return cls

class DummyComponent extends Component
  load: (module) ->
    i = module.interface
    @loadInterface(desc) for name, desc of i
    return super(module)

module.exports = {Component, ComponentCatalog, DummyComponent}

require("./alt_bridge")
require("./alt_clock")
require("./alt_memory")
require("./alt_peripheral")
require("./alt_processor")
require("./alt_serial")
