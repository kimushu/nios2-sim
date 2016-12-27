# Processors and Peripherals / Embedded Processors / *

{Component} = require("./component")
HEX8 = (v) -> ("0000000" + (v >>> 0).toString(16)).substr(-8)
DEC12 = (v) -> ("           " + (v >>> 0)).substr(-12)

class AlteraNios2 extends Component
  @kind: "altera_nios2_qsys"
  Component.register(this)

  isProcessor: true

  load: (module) ->
    a = module.assignment
    p = module.parameter
    i = module.interface
    @cfg = {
      bigEndian: (p.setting_bigEndian.value == "true")
      b31Bypass: (p.setting_bit31BypassDCache.value == "true")
      debug:  (p.debug_enabled.value == "true")
      div:    (a["embeddedsw.CMacro.HARDWARE_DIVIDE_PRESENT"] == "1")
      mul:    (a["embeddedsw.CMacro.HARDWARE_MULTIPLY_PRESENT"] == "1")
      mulx:   (a["embeddedsw.CMacro.HARDWARE_MULX_PRESENT"] == "1")
      evec:   parseInt(a["embeddedsw.CMacro.EXCEPTION_ADDR"])
      rvec:   parseInt(a["embeddedsw.CMacro.RESET_ADDR"])
      icache: parseInt(a["embeddedsw.CMacro.ICACHE_SIZE"])
      iline:  parseInt(a["embeddedsw.CMacro.ICACHE_LINE_SIZE"])
      dcache: parseInt(a["embeddedsw.CMacro.DCACHE_SIZE"])
      dline:  parseInt(a["embeddedsw.CMacro.DCACHE_LINE_SIZE"])
      tcim:   parseInt(p.icache_numTCIM.value)
      tcdm:   parseInt(p.dcache_numTCDM.value)
    }
    @im = [@loadInterface(i.instruction_master)]
    for n in [0...@cfg.tcim] by 1
      @im[n+1] = @loadInterface(i["tightly_coupled_instruction_master_#{n}"])
    @dm = [@loadInterface(i.data_master)]
    for n in [0...@cfg.tcdm] by 1
      @dm[n+1] = @loadInterface(i["tightly_coupled_data_master_#{n}"])
    @loadInterface(i.debug_mem_slave) if @cfg.debug

    summary = []
    summary.push("i-cache=#{@cfg.icache}") if @cfg.icache > 0
    summary.push("d-cache=#{@cfg.dcache}") if @cfg.dcache > 0
    summary.push("#inst_master=#{@im.length}")
    summary.push("#data_master=#{@dm.length}")
    summary.push("hw-div") if @cfg.div
    summary.push("hw-mul") if @cfg.mul
    summary.push("hw-mulx") if @cfg.mulx
    @options.printInfo("#{@path}: NiosII processor (#{summary.join(", ")})", 2)
    return super(module)

  connect: ->
    im.connect() for im in @im
    dm.connect() for dm in @dm
    return super()

  cpu_reset: ->
    # Reset general purpose registers
    @gpr = new Int32Array(32)
    @gpr.fill(0xdeadbeef)
    @gpr[0] = 0
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
          "No valid instruction memory for pc=0x#{@pc.toString(16)}"
        ) unless @inst?.length > 0
      if @options.cpuTrace
        console.log("(#{DEC12(@icnt)}) #{HEX8(@pc)}: #{HEX8(iw)}\t#{@cpu_disas(iw)}")
      newpc = @cpu_exec(iw)
      @gpr[0] = 0
      @icnt += 1
      if newpc?
        @iidx += (newpc - @pc) >> 2
        @pc = newpc
      else
        @iidx += 1
        @pc += 4
    return

  deploy: (addr, data) ->
    array = new Int8Array(data)
    for im in @im
      return true if im.write8(addr, array)
    throw Error("Cannot write memory from 0x#{addr.toString(16)}")

  core = require("./nios2core")
  @::cpu_exec = core.exec
  @::cpu_disas = core.disas

class AlteraNios2Gen2 extends AlteraNios2
  @kind: "altera_nios2_gen2"
  Component.register(this)

  load: (module) ->
    return super(module)

