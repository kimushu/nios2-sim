# nios2-sim : Altera NiosII CPU simulator

## Features
- NiosII CPU
  - Standard instruction set (without MMU/MPU)
  - Tightly-coupled instruction master ports
  - Tightly-coupled data master ports
  - Multiply instructions (mul, muli)
- System emulation
  - ELF loading
  - Qsys file import (.sopcinfo parsing)
  - Memory device support (On-chip memory and SDRAM controller)
  - Dummy module for unknown IP
  - Plugins for custom modules (`nios2-sim-ip-*`)
- Debugging
  - Simple CPU trace

## Usage

```
Usage: nios2-sim [options] <file>

Altera NiosII program simulator

Options:

  -h, --help                 output usage information
  -s, --sopcinfo <sopcinfo>  Specify .sopcinfo file
  --ignore-unknown           Ignore unknown components
  --cpu-trace                Show CPU trace
  -v, --verbose              Increase verbosity
```

## TODO
- mulx* instructions
- Load initialization for memory devices
- Exceptions
- div* instructions
- Custom instructions
- Shadow registers
- Cache handling
- MMU/MPU support

## License

MIT
