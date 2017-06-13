# Basic Functions / Bridges and Adaptors / *

{Module} = require("./module")

class AlteraAvalonMMBridge extends Module
  @kind: "altera_avalon_mm_bridge"
  Module.register(this)

  load: (module) ->
    i = module.interface
    @loadInterface(i.s0)
    @loadInterface(i.m0)
    return super(module)

