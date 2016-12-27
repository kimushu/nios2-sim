Promise = require("es6-promise")

class Interface
  @catalog: {}

  @register: (subclass) ->
    @catalog[subclass.kind] = subclass

  constructor: (@component, @options) ->
    @system = @component.system
    return

  load: (ifdesc) ->
    @name = ifdesc.$.name
    return

  connect: ->
    return

class InterfaceCatalog
  constructor: (@options) ->
    return

  lookup: (kind) ->
    return Interface.catalog[kind]

class AvalonMaster extends Interface
  @kind: "avalon_master"
  Interface.register(this)

  load: (ifdesc) ->
    @slaves = []
    for blk in ifdesc.memoryBlock
      s = {
        bridge: (blk.isBridge[0] == "true")
        component: blk.moduleName[0]
        interface: blk.slaveName[0]
        link: null
        base: parseInt(blk.baseAddress[0])
        size: parseInt(blk.span[0])
      }
      s.end = s.base + s.size
      @slaves.push(s)
    @slaves.sort((a, b) => a.base - b.base)
    return super(ifdesc)

  connect: ->
    for s in @slaves
      s.link = @system.components[s.component]?.
        interfaces?[s.interface]
      throw Error(
        "No target slave (#{s.component}.#{s.interface}) in this system"
      ) unless s.link?
      s.link.master.link = this
      @system.connections += 1
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
    return s?.link.read8(addr - s.base, count)

  read16: (addr, count) ->
    s = @getSlave(addr)
    return s?.link.read16((addr - s.base) >> 1, count)

  read32: (addr, count) ->
    s = @getSlave(addr)
    return s?.link.read32((addr - s.base) >> 2, count)

  write8: (addr, array) ->
    u8 = @read8(addr, array.length)
    return false unless u8?
    u8.set(array)
    return true

  write16: (addr, array) ->
    u16 = @read16(addr, array.length)
    return false unless u16?
    u16.set(array)
    return true

  write32: (addr, array) ->
    i32 = @read32(addr, array.length)
    return false unless i32?
    i32.set(array)
    return true

class AvalonSlave extends Interface
  @kind: "avalon_slave"
  Interface.register(this)

  load: (ifdesc) ->
    @master = {link: null}
    return super(ifdesc)

  read8: (offset, count) ->
    boff = offset & 3
    off32 = offset >>> 2
    cnt32 = (boff + count + 3) >>> 2
    i32 = @read32(off32, cnt32)
    return unless i32?
    return new Int8Array(i32.buffer, i32.byteOffset + boff, count)

  read16: (offset, count) ->
    woff = offset & 1
    off32 = offset >> 1
    cnt32 = (woff + count + 1) >> 1
    i32 = @read32(off32, cnt32)
    return unless i32?
    return new Int16Array(i32.buffer, i32.byteOffset + woff * 2, count * 2)

  write8: (offset, array) ->
    u8 = @read8(offset, array.length)
    return false unless u8?
    u8.set(array)
    return true

  write16: (offset, array) ->
    u16 = @read16(offset, array.length)
    return false unless u16?
    u16.set(array)
    return true

  write32: (offset, array) ->
    i32 = @read32(offset, array.length)
    return false unless i32?
    i32.set(array)
    return true

class AvalonSink extends Interface
  @kind: "avalon_streaming_sink"
  Interface.register(this)

class AvalonSource extends Interface
  @kind: "avalon_streaming_source"
  Interface.register(this)

class ClockSink extends Interface
  @kind: "clock_sink"
  Interface.register(this)

class ClockSource extends Interface
  @kind: "clock_source"
  Interface.register(this)

class Conduit extends Interface
  @kind: "conduit_end"
  Interface.register(this)

class InterruptSender extends Interface
  @kind: "interrupt_sender"
  Interface.register(this)

class NiosCustomInstructionMaster extends Interface
  @kind: "nios_custom_instruction_master"
  Interface.register(this)

class ResetSink extends Interface
  @kind: "reset_sink"
  Interface.register(this)

class ResetSource extends Interface
  @kind: "reset_source"
  Interface.register(this)

module.exports = {
  Interface, InterfaceCatalog,
  AvalonMaster, AvalonSlave, AvalonSink, AvalonSource,
  ClockSink, ClockSource, Conduit, NiosCustomInstructionMaster,
  ResetSink, ResetSource
}
