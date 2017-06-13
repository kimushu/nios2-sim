# Processors and Peripherals / Embedded Processors / *

Promise = require("es6-promise")
{Module} = require("./module")
sprintf = require("./sprintf")

class AlteraNios2 extends Module
  @kind: "altera_nios2_qsys"
  Module.register(this)

  isProcessor: true

  load: (module) ->
    a = module.assignment
    p = module.parameter
    i = module.interface
    @cfg = {
      bigEndian: (p.setting_bigEndian?.value == "true")
      b31Bypass: (p.setting_bit31BypassDCache?.value == "true")
      debug:  (p.debug_enabled?.value == "true")
      div:    (a.embeddedsw.CMacro.HARDWARE_DIVIDE_PRESENT == "1")
      mul:    (a.embeddedsw.CMacro.HARDWARE_MULTIPLY_PRESENT == "1")
      mulx:   (a.embeddedsw.CMacro.HARDWARE_MULX_PRESENT == "1")
      evec:   parseInt(a.embeddedsw.CMacro.EXCEPTION_ADDR ? 0)
      rvec:   parseInt(a.embeddedsw.CMacro.RESET_ADDR)
      icache: parseInt(a.embeddedsw.CMacro.ICACHE_SIZE ? 0)
      iline:  parseInt(a.embeddedsw.CMacro.ICACHE_LINE_SIZE ? 0)
      dcache: parseInt(a.embeddedsw.CMacro.DCACHE_SIZE ? 0)
      dline:  parseInt(a.embeddedsw.CMacro.DCACHE_LINE_SIZE ? 0)
      tcim:   parseInt(p.icache_numTCIM?.value ? 0)
      tcdm:   parseInt(p.dcache_numTCDM?.value ? 0)
    }
    @im = [@loadInterface(i.instruction_master)]
    for n in [0...@cfg.tcim] by 1
      @im[n+1] = @loadInterface(i["tightly_coupled_instruction_master_#{n}"])
    @dm = [@loadInterface(i.data_master)]
    for n in [0...@cfg.tcdm] by 1
      @dm[n+1] = @loadInterface(i["tightly_coupled_data_master_#{n}"])
    @loadInterface(i.debug_mem_slave) if @cfg.debug

    summary = []
    summary.push("ICache=#{@cfg.icache/1024}k") if @cfg.icache > 0
    summary.push("DCache=#{@cfg.dcache/1024}k") if @cfg.dcache > 0
    summary.push("#IMaster=#{@im.length}")
    summary.push("#DMaster=#{@dm.length}")
    summary.push("hw-div") if @cfg.div
    summary.push("hw-mul") if @cfg.mul
    summary.push("hw-mulx") if @cfg.mulx
    @options.printInfo("[#{@path}] NiosII processor (#{summary.join(", ")})", 2)
    return super

  loadProgram: (addr, data) ->
    array = new Int8Array(data)
    for im in @im
      result = im.write8(addr, array)
      return result if result?
    throw Error("Cannot write memory from 0x#{addr.toString(16)}")

  resetProcessor: ->
    # Reset general purpose registers
    # Reset control registers
    @sts = 0    # status
    @est = 0    # estatus
    @bst = 0    # bstatus
    @ipend = 0  # ipending
    @excc = 0   # exception
    # Reset program counter
    @pc = @cfg.rvec
    @icnt = 0
    @inst = null
    @iidx = null
    return

  cpu_work: (count = 256) ->
    while count > 0
      count -= 1
      while true
        iw = @inst?[@iidx]
        break if iw?
        @inst = null
        @iidx = 0
        for im in @im
          @inst = im.read32(@pc)
          break if @inst?
        throw Error(
          "No valid instruction memory for pc=0x#{HEX8(@pc)}"
        ) unless @inst?.length > 0
      if @options.cpuTrace
        console.log("(#{DEC12(@icnt)}) #{HEX8(@pc)}: #{HEX8(iw)}\t#{@cpu_disas(iw)}")
      newpc = @cpu_exec(iw)
      @gpr[0] = 0
      @icnt += 1
      if newpc?
        return Promise.reject(
          Error("Simulation aborted by infinite loop")
        ) if newpc == @pc
        @iidx += (newpc - @pc) >> 2
        @pc = newpc
      else
        @iidx += 1
        @pc += 4
    return

  core = require("./nios2core")
  @::cpu_exec = core.exec
  @::cpu_disas = core.disas

  dwrite8: (addr, value) ->
    for dm in @dm
      return true if dm.write8(addr, [value])
    return false

  dwrite16: (addr, value) ->
    for dm in @dm
      return true if dm.write16(addr, [value])
    return false

  dwrite32: (addr, value) ->
    for dm in @dm
      return true if dm.write32(addr, [value])
    return false

  dread8: (addr) ->
    for dm in @dm
      a = dm.read8(addr, 1)
      return a[0] if a?
    throw Error("invalid data read addr=0x#{HEX8(addr)}")  # TODO

  dread16: (addr) ->
    for dm in @dm
      a = dm.read16(addr, 1)
      return a[0] if a?
    throw Error("invalid data read addr=0x#{HEX8(addr)}")  # TODO

  dread32: (addr) ->
    for dm in @dm
      a = dm.read32(addr, 1)
      return a[0] if a?
    throw Error("invalid data read addr=0x#{HEX8(addr)}")  # TODO

class AlteraNios2Gen2 extends AlteraNios2
  @kind: "altera_nios2_gen2"
  Module.register(this)

