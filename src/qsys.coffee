Promise = require("es6-promise")
{parseString} = require("xml2js")
{Module} = require("./module")
{IpCatalog} = require("./ipcatalog")
{SopcInfo} = require("./sopcinfo")

BARE_RAM_BASE = 0x00001000
BARE_RAM_SIZE = 0x10000000 - BARE_RAM_BASE

class Qsys
  constructor: (@options) ->
    @modules = {}
    return

  create: (image) ->
    return @load("""
      <?xml version="1.0" encoding="UTF-8"?>
      <EnsembleReport name="default_system" kind="default_system" fabric="QSYS">
       <parameter name="SYSTEM_FOR_SIMULATOR">
        <type>boolean</type>
        <value>true</value>
        <derived>false</derived>
        <enabled>true</enabled>
        <visible>false</visible>
        <valid>true</valid>
       </parameter>
       <module name="cpu" kind="altera_nios2_gen2" path="cpu">
        <assignment>
         <name>embeddedsw.CMacro.HARDWARE_DIVIDE_PRESENT</name>
         <value>0</value>
        </assignment>
        <assignment>
         <name>embeddedsw.CMacro.HARDWARE_MULTIPLY_PRESENT</name>
         <value>1</value>
        </assignment>
        <assignment>
         <name>embeddedsw.CMacro.HARDWARE_MULX_PRESENT</name>
         <value>0</value>
        </assignment>
        <assignment>
         <name>embeddedsw.CMacro.RESET_ADDR</name>
         <value>#{image.entry}</value>
        </assignment>
        <interface name="data_master" kind="avalon_master">
         <memoryBlock>
          <isBridge>false</isBridge>
          <moduleName>ram</moduleName>
          <slaveName>s1</slaveName>
          <name>ram.s1</name>
          <baseAddress>#{BARE_RAM_BASE}</baseAddress>
          <span>#{BARE_RAM_SIZE}</span>
         </memoryBlock>
        </interface>
        <interface name="instruction_master" kind="avalon_master">
         <memoryBlock>
          <isBridge>false</isBridge>
          <moduleName>ram</moduleName>
          <slaveName>s1</slaveName>
          <name>ram.s1</name>
          <baseAddress>#{BARE_RAM_BASE}</baseAddress>
          <span>#{BARE_RAM_SIZE}</span>
         </memoryBlock>
        </interface>
       </module>
       <module name="ram" kind="altera_avalon_new_sdram_controller" path="ram">
        <interface name="s1" kind="avalon_slave">
         <assignment>
          <name>embeddedsw.configuration.isMemoryDevice</name>
          <value>1</value>
         </assignment>
        </interface>
       </module>
      </EnsembleReport>
    """) # return @load()

  load: (xml) ->
    return Promise.resolve(
    ).then(=>
      # Parse sopcinfo
      return SopcInfo.parse(xml)
    ).then((@info) =>
      # Validate sopcinfo
      unless @info.fabric == "QSYS"
        return Promise.reject(Error("Invalid .sopcinfo file"))

      # Load modules
      cat = new IpCatalog(@options)
      names = (name for name of @info.module)
      return names.reduce(
        (promise, name) =>
          return promise.then(
          ).then(=>
            m = @info.module[name]
            @options.printInfo("Adding module: #{m.path} (#{m.kind})", 2)
            cls = cat.search(m.kind)
            throw Error("No emulator for #{m.kind} module") unless cls?
            mod = new cls(m.path, this, @options)
            @modules[m.path] = mod
            return mod.load(m)
          ) # return promise.then()
        Promise.resolve()
      ) # return names.reduce()
    ).then(=>
      names = (name for name of @modules)
      @options.printInfo("Connecting modules")
      return names.reduce(
        (promise, name) =>
          return promise.then(=>
            return @modules[name].connect()
          ) # return promise.then()
        Promise.resolve()
      ) # return names.reduce()
    ) # return Promise.resolve().then()...

  loadImage: (image) ->
    cpu = null
    return Promise.resolve(
    ).then(=>
      cpu_name = image.body?.sections.find(
        (s) => s.name == ".cpu"
      )?.data.toString()
      if cpu_name?
        cpu = @modules[cpu_name]
        throw Error(
          "Processor \"#{cpu_name}\" is not found in this system"
        ) unless cpu?.isProcessor
      else
        for n, c of @modules
          if c.isProcessor 
            cpu = c
            break
        throw Error("No processor detected in this system") unless cpu?
        @options.printWarn("No processor specified. Use \"#{cpu.name}\"")
      @options.printInfo("Deploying executable image through processor \"#{cpu.name}\"", 1)
      return (image.body?.programs ? []).reduce(
        (promise, p) =>
          return promise unless p.type == "load" or p.type == "lz4-load"
          return promise.then(=>
            ba = p.paddr
            ea = ba + p.memsz
            hex8 = (v) -> ("0000000" + (v >>> 0).toString(16)).substr(-8)
            @options.printInfo("Writing memory 0x#{hex8(ba)}-0x#{hex8(ea-1)}", 2)
            cpu.loadProgram(ba, p.data) if p.filesz > 0
            ba += p.filesz
            zs = ea - ba
            return cpu.loadProgram(ba, Buffer.alloc(zs)) if zs > 0
          )
        Promise.resolve()
      ) # (...).reduce()
    ).then(=>
      return cpu.resetProcessor()
    ).then(=>
      return cpu.runner
    )

module.exports = {Qsys}
