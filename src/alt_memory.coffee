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
    @buffer = Buffer.alloc(@size)
    @i8  = new Int8Array(@buffer)
    @i16 = new Int16Array(@buffer)
    @i32 = new Int32Array(@buffer)
    @s1 = @loadInterface(i.s1)
    @s2 = @loadInterface(i.s2) if @dualPort
    return super(module)

  connect: ->
    @s1.connect()
    @s1.read32 = (offset, count) =>
      @i32.subarray(offset, if count? then offset + count else undefined)
    @s2?.connect()
    @s2?.read32 = @s1.read32
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

