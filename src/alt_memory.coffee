# Basic Functions / On Chip Memory / *
# Memory Interfaces and Controllers / *

{Module} = require("./module")

class MemoryDevice extends Module
  load: (module) ->
    p = module.parameter
    i = module.interface
    @options.printInfo("[#{@path}] Memory device (#{@size} bytes)", 2)
    @writable ?= true
    @dualPort ?= false
    @buffer = new ArrayBuffer(@size)
    @i32 = new Int32Array(@buffer)
    @s1 = @loadInterface(i.s1)
    @s2 = @loadInterface(i.s2) if @dualPort
    return super

  connect: ->
    @s1.read32 = (offset, count) =>
      @i32.subarray(offset, if count? then offset + count else undefined)
    @s2?.read32 = @s1.read32
    return super

class AlteraAvalonOnchipMemory2 extends MemoryDevice
  @kind: "altera_avalon_onchip_memory2"
  Module.register(this)

  load: (module) ->
    p = module.parameter
    @writable = (p.writable.value == "true")
    @dualPort = (p.dualPort.value == "true")
    @size = parseInt(p.memorySize?.value)
    return super

class AlteraAvalonNewSDRAMController extends MemoryDevice
  @kind: "altera_avalon_new_sdram_controller"
  Module.register(this)

  load: (module) ->
    p = module.parameter
    @size = parseInt(p.size?.value)
    return super

