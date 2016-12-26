# Processors and Peripherals / Embedded Processors / *

{Component} = require("./component")

class AlteraNios2 extends Component
  @kind: "altera_nios2_qsys"
  Component.register(this)

  load: (module) ->
    a = module.assignment
    p = module.parameter
    i = module.interface
    @cfg = {
      bigEndian: (p.setting_bigEndian.value == "true")
      b31Bypass: (p.setting_bit31BypassDCache.value == "true")
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
    @im = [@createInterface(i.instruction_master)]
    for n in [0...@cfg.tcim] by 1
      @im[n+1] = @createInterface(i["tightly_coupled_instruction_master_#{n}"])
    @dm = [@createInterface(i.data_master)]
    for n in [0...@cfg.tcdm] by 1
      @dm[n+1] = @createInterface(i["tightly_coupled_data_master_#{n}"])

    summary = []
    summary.push("ICache=#{@cfg.icache}") if @cfg.icache > 0
    summary.push("DCache=#{@cfg.dcache}") if @cfg.dcache > 0
    summary.push("#inst_master=#{@im.length}")
    summary.push("#data_master=#{@dm.length}")
    summary.push("hw-div") if @cfg.div
    summary.push("hw-mul") if @cfg.mul
    summary.push("hw-mulx") if @cfg.mulx
    @options.printInfo("#{@path}: NiosII processor (#{summary.join(", ")})", 2)
    return super(module)

  connect: ->
    im.connect() for im in @dm
    dm.connect() for dm in @dm
    return super()

  cpu_reset: ->
    @gpr = new Int32Array(32)
    @gpr.fill(0xdeadbeef)
    @ctr = new Int32Array(16)
    return

class AlteraNios2Gen2 extends AlteraNios2
  @kind: "altera_nios2_gen2"
  Component.register(this)

  load: (module) ->
    return super(module)

