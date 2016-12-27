# Processors and Peripherals / Peripherals / *

{Component} = require("./component")

class AlteraAvalonTimer extends Component
  @kind: "altera_avalon_timer"
  Component.register(this)

  load: (module) ->
    @loadInterface(module.interface.s1)
    return super(module)

