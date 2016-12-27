# Interface Protocols / Serial / *

{Component} = require("./component")

class AlteraAvalonUART extends Component
  @kind: "altera_avalon_uart"
  Component.register(this)

  load: (module) ->
    @loadInterface(module.interface.s1)
    return super(module)

