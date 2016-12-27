# Basic Functions / Bridges and Adaptors / *

{Component} = require("./component")

class AlteraAvalonMMBridge extends Component
  @kind: "altera_avalon_mm_bridge"
  Component.register(this)

  load: (module) ->
    i = module.interface
    @loadInterface(i.s0)
    @loadInterface(i.m0)
    return super(module)

