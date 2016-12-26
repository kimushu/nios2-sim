class Component
  @catalog: {}

  @register: (subclass) ->
    @catalog[subclass.kind] = subclass
    return

  constructor: (@path, @system, @options) ->
    return

  load: (module) ->
    return Promise.resolve()

  connect: ->
    return

  createInterface: (ifdesc) ->
    return @system.createInterface(this, ifdesc)

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
  null

module.exports = {Component, ComponentCatalog, DummyComponent}

require("./alt_bridge")
require("./alt_clock")
require("./alt_memory")
require("./alt_peripheral")
require("./alt_processor")
require("./alt_serial")
