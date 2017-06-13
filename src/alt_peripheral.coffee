# Processors and Peripherals / Peripherals / *

{Module} = require("./module")

class AlteraAvalonTimer extends Module
  @kind: "altera_avalon_timer"
  Module.register(this)

  load: (module) ->
    @loadInterface(module.interface.s1)
    return super(module)

