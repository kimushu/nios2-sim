Promise = require("es6-promise")

class Interface
  @catalog: {}

  @register: (subclass) ->
    @catalog[subclass.kind] = subclass

  constructor: (@options, @system) ->
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

class AvalonSlave extends Interface
  @kind: "avalon_slave"
  Interface.register(this)

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
