{DummyModule} = require("./module")

class exports.IpCatalog
  @global = {}

  @register: (kind, constructor) ->
    @global[kind] = constructor
    return

  constructor: (@options) ->
    @local = {}
    return

  search: (kind, useDummy = true) ->
    cls = @local[kind] or @constructor.global[kind]
    if !cls? and useDummy and @options.ignoreUnknown
      @options.printWarn("No emulator for #{kind} found. Replaced with dummy module.")
      cls = DummyModule
    return cls

