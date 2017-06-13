# Interface Protocols / Serial / *

{Module} = require("./module")

class AlteraAvalonUART extends Module
  @kind: "altera_avalon_uart"
  Module.register(this)

  load: (module) ->
    @loadInterface(module.interface.s1)
    return super(module)

