# Basic Functions / On Chip Memory / *
# Memory Interfaces and Controllers / *

{Component} = require("./component")

class MemoryDevice extends Component
  load: (module) ->
    p = module.parameter
    i = module.interface
    @options.printInfo("#{@path}: Memory device (#{@size} bytes)", 2)
    @writable ?= true
    @dualPort ?= false
    @buffer = new ArrayBuffer(@size)
    @u8  = new Uint8Array(@buffer)
    @u16 = new Uint16Array(@buffer)
    @u32 = new Uint32Array(@buffer)
    @s1 = @createInterface(i.s1)
    @s2 = @createInterface(i.s2) if @dualPort
    return super(module)

  connect: ->
    @s1.connect()
    @s2?.connect()
    return super()

class AlteraAvalonOnchipMemory2 extends MemoryDevice
  @kind: "altera_avalon_onchip_memory2"
  Component.register(this)

  load: (module) ->
    p = module.parameter
    @writable = (p.writable.value == "true")
    @dualPort = (p.dualPort.value == "true")
    @size = parseInt(p.memorySize?.value)
    return super(module)

class AlteraAvalonNewSDRAMController extends MemoryDevice
  @kind: "altera_avalon_new_sdram_controller"
  Component.register(this)

  load: (module) ->
    p = module.parameter
    @size = parseInt(p.size?.value)
    return super(module)

