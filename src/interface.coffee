Interface = class exports.Interface
  @subclasses: {}

  @register: (subclass) ->
    @subclasses[subclass.kind] = subclass

  @search: (kind) ->
    return @subclasses[kind]

  constructor: (@module, @options) ->
    @system = @module.system
    return

  load: (ifc) ->
    @name = ifc.name
    return

  connect: ->
    return

class exports.AvalonMaster extends Interface
  @kind: "avalon_master"
  Interface.register(this)

  load: (ifc) ->
    @slaves = []
    for blk in ifc.memoryBlock
      s = {
        bridge: (blk.isBridge?[0] == "true")
        module: blk.moduleName[0]
        interface: blk.slaveName[0]
        link: null
        base: parseInt(blk.baseAddress[0])
        size: parseInt(blk.span[0])
      }
      s.end = s.base + s.size
      @slaves.push(s)
    @slaves.sort((a, b) => a.base - b.base)
    return super(ifc)

  connect: ->
    for s in @slaves
      target = @module.system.modules[s.module]
      @options.printInfo("Connecting: #{@module.path}.#{@name}" +
        " => #{target.path}.#{s.interface}", 3)
      s.link = target?.interfaces[s.interface]
      throw Error(
        "No target slave (#{s.module}.#{s.interface}) in this system"
      ) unless s.link?
      s.link.master.link = this
    return

  getSlave: (addr) ->
    top = 0
    btm = @slaves.length
    while top < btm
      mid = (top + btm) >>> 1
      s = @slaves[mid]
      if addr < s.base
        btm = mid
      else if addr >= s.end
        top = mid + 1
      else
        return s
    return

  read8: (addr, count) ->
    s = @getSlave(addr)
    return s?.link.read8((addr - s.base) >> 0, count)

  read16: (addr, count) ->
    s = @getSlave(addr)
    return s?.link.read16((addr - s.base) >> 1, count)

  read32: (addr, count) ->
    s = @getSlave(addr)
    return s?.link.read32((addr - s.base) >> 2, count)

  write8: (addr, array) ->
    s = @getSlave(addr)
    return s?.link.write8((addr - s.base) >> 0, array)

  write16: (addr, array) ->
    s = @getSlave(addr)
    return s?.link.write16((addr - s.base) >> 1, array)

  write32: (addr, array) ->
    s = @getSlave(addr)
    return s?.link.write32((addr - s.base) >> 2, array)

class exports.AvalonSlave extends Interface
  @kind: "avalon_slave"
  Interface.register(this)

  load: (ifc) ->
    @master = {link: null}
    return super(ifc)

  read8: (offset, count) ->
    boff = offset & 3
    off32 = offset >>> 2
    cnt32 = (boff + count + 3) >>> 2
    i32 = @read32(off32, cnt32)
    return unless i32?
    return i32.then((_i32) =>
      return new Int8Array(_i32.buffer, _i32.byteOffset + boff, count)
    ) if i32.then?
    return new Int8Array(i32.buffer, i32.byteOffset + boff, count)

  read16: (offset, count) ->
    woff = offset & 1
    off32 = offset >> 1
    cnt32 = (woff + count + 1) >> 1
    i32 = @read32(off32, cnt32)
    return unless i32?
    return i32.then((_i32) =>
      return new Int16Array(_i32.buffer, _i32.byteOffset + woff * 2, count * 2)
    ) if i32.then?
    return new Int16Array(i32.buffer, i32.byteOffset + woff * 2, count * 2)

  write8: (offset, array) ->
    u8 = @read8(offset, array.length)
    return false unless u8?
    throw Error(
      "Asynchronous writer (write8) is not defined"
    ) if u8.then?
    u8.set(array)
    return true

  write16: (offset, array) ->
    u16 = @read16(offset, array.length)
    return false unless u16?
    throw Error(
      "Asynchronous writer (write16) is not defined"
    ) if u16.then?
    u16.set(array)
    return true

  write32: (offset, array) ->
    i32 = @read32(offset, array.length)
    return false unless i32?
    throw Error(
      "Asynchronous writer (write32) is not defined"
    ) if i32.then?
    i32.set(array)
    return true

class exports.AvalonSink extends Interface
  @kind: "avalon_streaming_sink"
  Interface.register(this)

class exports.AvalonSource extends Interface
  @kind: "avalon_streaming_source"
  Interface.register(this)

class exports.ClockSink extends Interface
  @kind: "clock_sink"
  Interface.register(this)

class exports.ClockSource extends Interface
  @kind: "clock_source"
  Interface.register(this)

class exports.Conduit extends Interface
  @kind: "conduit_end"
  Interface.register(this)

class exports.InterruptSender extends Interface
  @kind: "interrupt_sender"
  Interface.register(this)

class exports.NiosCustomInstructionMaster extends Interface
  @kind: "nios_custom_instruction_master"
  Interface.register(this)

class exports.ResetSink extends Interface
  @kind: "reset_sink"
  Interface.register(this)

class exports.ResetSource extends Interface
  @kind: "reset_source"
  Interface.register(this)
