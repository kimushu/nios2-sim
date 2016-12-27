
list = {}

TYPE_I = 0
TYPE_J = 1
TYPE_R = 2

def = (op, type, exec, disas) ->
  list[op] = {type: type, exec: exec, disas: disas}
  return

call_op = (iw, m, _this) ->
  op = iw & 0x3f
  op += (iw >> 3) & 0x3f00 if op == 0x3a
  inst = list[op]
  throw 0 unless inst?  # TODO
  switch inst.type
    when TYPE_I
      return inst[m].call(
        _this
        (iw >> 27) & 0x1f
        (iw >> 22) & 0x1f
        (iw << 10) >> 16
      )
    when TYPE_J
      return inst[m].call(
        _this
        (iw >>> 6)
      )
    when TYPE_R
      return inst[m].call(
        _this
        (iw >> 27) & 0x1f
        (iw >> 22) & 0x1f
        (iw >> 17) & 0x1f
        (iw >>  6) & 0x7ff
      )

exec  = (iw) -> call_op(iw, "exec", this)
disas = (iw) -> call_op(iw, "disas", this)

ZR = 0
EA = 29
BA = 30
RA = 31

GPRN = {
  0: "zero"
  1: "at"
  24: "et"
  25: "bt"
  26: "gp"
  27: "sp"
  28: "fp"
  29: "ea"
  30: "ba"  # TODO
  31: "ra"
}

GPRN[i] ?= "r#{i}" for i in [0...32]

CTRN = {
  0: "status"
  1: "estatus"
  2: "bstatus"
  3: "ienable"
  4: "ipending"
  5: "cpuid"
  7: "exception"
  8: "pteaddr"
  9: "tlbacc"
  10: "tlbmisc"
  11: "eccinj"
  12: "badaddr"
  13: "config"
  14: "mpubase"
  15: "mpuacc"
}

CTRN[i] ?= "ctl#{i}" for i in [0...32]

HEX8 = (v) -> "0x" + ("0000000" + (v >>> 0).toString(16)).substr(-8)
SE16 = (v) -> (v << 16) >> 16

D_N   = (m)           -> "#{m}\t"
D_D   = (m, v)        -> "#{m}\t#{v}"
D_H   = (m, v)        -> "#{m}\t#{HEX8(v)}"
D_R   = (m, x)        -> "#{m}\t#{GPRN[x]}"
D_RC  = (m, x, n)     -> "#{m}\t#{GPRN[x]}, #{CTRN[n]}"
D_OR  = (m, v, x)     -> "#{m}\t#{v}(#{GPRN[x]})"
D_RD  = (m, x, v)     -> "#{m}\t#{GPRN[x]}, #{v}"
D_RR  = (m, x, y, v)  -> "#{m}\t#{GPRN[x]}, #{GPRN[y]}"
D_ROR = (m, x, v, y)  -> "#{m}\t#{GPRN[x]}, #{v}(#{GPRN[y]})"
D_RRR = (m, x, y, z)  -> "#{m}\t#{GPRN[x]}, #{GPRN[y]}, #{GPRN[z]}"
D_RRH = (m, x, y, v)  -> "#{m}\t#{GPRN[x]}, #{GPRN[y]}, #{HEX8(v)}"
D_RRD = (m, x, y, v)  -> "#{m}\t#{GPRN[x]}, #{GPRN[y]}, #{v}"

# call
def(0x00, TYPE_J,
  (u26) ->
    @gpr[RA] = @pc + 4
    return u26 << 2
  (u26) ->
    return D_H("call", u26)
)

# jmpi
def(0x01, TYPE_J,
  (u26) ->
    return u26 << 2
  (u26) ->
    return D_H("jmpi", u26)
)

# 0x02 - no instruction

# ldbu
def(0x03, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @dread8(@gpr[ra] + s16)
    return
  (ra, rb, s16) ->
    return D_ROR("ldbu", rc, s16, ra)
)

# addi
def(0x04, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @gpr[ra] + s16
    return
  (ra, rb, s16) ->
    return D_RD("movi", rb, s16) if ra == ZR
    return D_RRD("addi", rb, ra, s16)
)

# stb
def(0x05, TYPE_I,
  (ra, rb, s16) ->
    @dwrite8(@gpr[ra] + s16, @gpr[rb])
    return
  (ra, rb, s16) ->
    return D_ROR("stb", rc, s16, ra)
)

# br
def(0x06, TYPE_I,
  (ra, rb, s16) ->
    return @pc + 4 + s16
  (ra, rb, s16) ->
    return D_H("br", @pc + 4 + s16)
)

# ldb
def(0x07, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = SE8(@dread8(@gpr[ra] + s16))
    return
  (ra, rb, s16) ->
    return D_ROR("ldb", rc, s16, ra)
)

# cmpgei
def(0x08, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = if @gpr[ra] >= s16 then 1 else 0
    return
  (ra, rb, s16) ->
    return D_RRD("cmpgei", rb, ra, s16)
)

# 0x09 - no instruction

# 0x0a - no instruction

# ldhu
def(0x0b, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @dread16(@gpr[ra] + s16)
    return
  (ra, rb, s16) ->
    return D_ROR("ldhu", rc, s16, ra)
)

# andi
def(0x0c, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @gpr[ra] & (s16 & 0xffff)
  (ra, rb, s16) ->
    return D_RRD("andi", rb, ra, s16 & 0xffff)
)

# sth
def(0x0d, TYPE_I,
  (ra, rb, s16) ->
    @dwrite16(@gpr[ra] + s16, @gpr[rb])
    return
  (ra, rb, s16) ->
    return D_ROR("sth", rc, s16, ra)
)

# bge
def(0x0e, TYPE_I,
  (ra, rb, s16) ->
    return @pc + 4 + s16 if @gpr[ra] >= @gpr[rb]
    return
  (ra, rb, s16) ->
    return D_RRH("bge", ra, rb, @pc + 4 + s16)
)

# ldh
def(0x0f, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = SE16(@dread16(@gpr[ra] + s16))
    return
  (ra, rb, s16) ->
    return D_ROR("ldh", rc, s16, ra)
)

# cmplti
def(0x10, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = if @gpr[ra] < s16 then 1 else 0
    return
  (ra, rb, s16) ->
    return D_RRD("cmplti", rb, ra, s16)
)

# 0x11 - no instruction

# 0x12 - no instruction

# initda
def(0x13, TYPE_I,
  (ra, rb, s16) ->
    throw 0 # TODO
  (ra, rb, s16) ->
    return D_OR("initda", s16, ra)
)

# ori
def(0x14, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @gpr[ra] | (s16 & 0xffff)
    return
  (ra, rb, s16) ->
    return D_RD("movui", rb, s16 & 0xffff) if ra == ZR
    return D_RRD("ori", rb, ra, s16 & 0xffff)
)

# stw
def(0x15, TYPE_I,
  (ra, rb, s16) ->
    @dwrite32(@gpr[ra] + s16, @gpr[rb])
    return
  (ra, rb, s16) ->
    return D_ROR("stw", rb, s16, ra)
)

# blt
def(0x16, TYPE_I,
  (ra, rb, s16) ->
    return @pc + 4 + s16 if @gpr[ra] < @gpr[rb]
    return
  (ra, rb, s16) ->
    return D_RRH("blt", ra, rb, @pc + 4 + s16)
)

# ldw
def(0x17, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @dread32(@gpr[ra] + s16, 4)
    return
  (ra, rb, s16) ->
    return D_ROR("ldw", rb, s16, ra)
)

# cmpnei
def(0x18, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = if @gpr[ra] != s16 then 1 else 0
    return
  (ra, rb, s16) ->
    return D_RRD("cmpnei", rb, ra, s16)
)

# 0x19 - no instruction

# 0x1a - no instruction

# flashda
def(0x1b, TYPE_I,
  (ra, rb, s16) ->
    throw 0 # TODO
  (ra, rb, s16) ->
    return D_OR("flashda", s16, ra)
)

# xori
def(0x1c, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @gpr[ra] ^ (s16 & 0xffff)
    return
  (ra, rb, s16) ->
    return D_RRD("xori", rb, ra, s16 & 0xffff)
)

# 0x1d - no instruction

# bne
def(0x1e, TYPE_I,
        # (I) bne
  (ra, rb, s16) ->
    return @pc + 4 + s16 if @gpr[ra] != @gpr[rb]
    return
  (ra, rb, s16) ->
    return D_RRH("bne", ra, rb, @pc + 4 + s16)
)

# 0x1f - no instruction

# cmpeqi
def(0x20, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = if @gpr[ra] == s16 then 1 else 0
    return
  (ra, rb, s16) ->
    return D_RRD("cmpeqi", rb, ra, s16)
)

# 0x21 - no instruction

# 0x22 - no instruction

# ldbu
def(0x23, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @ioread8(@gpr[ra] + s16)
    return
  (ra, rb, s16) ->
    return D_ROR("ldbuio", rb, s16, ra)
)

# muli
def(0x24, TYPE_I,
  (ra, rb, s16) ->
    throw "Unsupported" unless cfg.mul # TODO
    throw 0 # TODO
  (ra, rb, s16) ->
    return D_RRD("muli", rb, ra, s16)
)

# stbio
def(0x25, TYPE_I,
  (ra, rb, s16) ->
    @iowrite8(@gpr[ra] + s16, @gpr[rb])
    return
  (ra, rb, s16) ->
    return D_ROR("stbio", rb, s16, ra)
)

# beq
def(0x26, TYPE_I,
  (ra, rb, s16) ->
    return @pc + 4 + s16 if @gpr[ra] == @gpr[rb]
    return
  (ra, rb, s16) ->
    return D_RRH("beq", ra, rb, @pc + 4 + s16)
)

# ldb
def(0x27, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = SE8(@ioread8(@gpr[ra] + s16))
    return
  (ra, rb, s16) ->
    return D_ROR("ldbio", rb, s16, ra)
)

# cmpgeui
def(0x28, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = if @gpr[ra] >= (s16 & 0xffff) then 1 else 0
    return
  (ra, rb, s16) ->
    return D_RRD("cmpgeui", rb, ra, s16 & 0xffff)
)

# 0x29 - no instruction

# 0x2a - no instruction

# ldhu
def(0x2b, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @ioread16(@gpr[ra] + s16)
    return
  (ra, rb, s16) ->
    return D_ROR("ldhuio", rb, s16, ra)
)

def(0x2c, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @gpr[ra] & (s16 << 16)
    return
  (ra, rb, s16) ->
    return D_RRD("andhi", rb, ra, s16 & 0xffff)
)

# sthio
def(0x2d, TYPE_I,
  (ra, rb, s16) ->
    @iowrite16(@gpr[ra] + s16, @gpr[rb])
    return
  (ra, rb, s16) ->
    return D_ROR("sthio", rb, s16, ra)
)

# bgeu
def(0x2e, TYPE_I,
  (ra, rb, s16) ->
    return @pc + 4 + s16 if (@gpr[ra] >>> 0) >= (@gpr[rb] >>> 0)
    return
  (ra, rb, s16) ->
    return D_RRH("bgeu", ra, rb, @pc + 4 + s16)
)

# ldh
def(0x2f, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = SE16(@ioread16(@gpr[ra] + s16))
    return
  (ra, rb, s16) ->
    return D_ROR("ldhio", rb, s16, ra)
)

# cmpltui
def(0x30, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = if (@gpr[ra] >>> 0) < (s16 & 0xffff) then 1 else 0
    return
  (ra, rb, s16) ->
    return D_RRD("cmpltui", rb, ra, s16 & 0xffff)
)

# 0x31 - no instruction

# custom
def(0x32, TYPE_R,
  (ra, rb, rc, opx) ->
    throw 0 # TODO
  (ra, rb, rc, opx) ->
    n = opx & 0xff
    d = D_D("custom", n)
    d += ", #{if (opx & 0x4000) then GPRN[rc] else "c#{rc}"}"
    d += ", #{if (opx & 0x10000) then GPRN[ra] else "c#{ra}"}"
    d += ", #{if (opx & 0x8000) then GPRN[rb] else "c#{rb}"}"
    return d
)

# initd
def(0x33, TYPE_I,
  (ra, rb, s16) ->
    throw 0 # TODO
  (ra, rb, s16) ->
    return D_OR("initd", s16, ra)
)

# orhi
def(0x34, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @gpr[ra] | (s16 << 16)
    return
  (ra, rb, s16) ->
    return D_RD("movhi", rb, s16 & 0xffff) if ra == ZR
    return D_RRD("orhi", rb, ra, s16 & 0xffff)
)

# stwio
def(0x35, TYPE_I,
  (ra, rb, s16) ->
    @iowrite32(@gpr[ra] + s16, @gpr[rb])
    return
  (ra, rb, s16) ->
    return D_ROR("stwio", rb, s16, ra)
)

# bltu
def(0x36, TYPE_I,
  (ra, rb, s16) ->
    return @pc + 4 + s16 if (@gpr[ra] >>> 0) < (@gpr[rb] >>> 0)
    return
  (ra, rb, s16) ->
    return D_RRH("bltu", ra, rb, @pc + 4 + s16)
)

# ldwio
def(0x37, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @ioread32(@gpr[ra] + s16, 4)
    return
  (ra, rb, s16) ->
    return D_ROR("ldwio", rb, s16, ra)
)

# rdprs
def(0x38, TYPE_I,
  (ra, rb, s16) ->
    throw 0 # TODO
  (ra, rb, s16) ->
    return D_RRD("rdprs", rb, ra, s16)
)

# 0x39 - no instruction

# 0x3a - R-type (written below)

# flashd
def(0x3b, TYPE_I,
  (ra, rb, s16) ->
    throw 0 # TODO
  (ra, rb, s16) ->
    return D_OR("flashd", s16, ra)
)

# xorhi
def(0x3c, TYPE_I,
  (ra, rb, s16) ->
    @gpr[rb] = @gpr[ra] ^ (s16 << 16)
    return
  (ra, rb, s16) ->
    return D_RRD("xorhi", rb, ra, s16 & 0xffff)
)

# 0x3d - no instruction

# 0x3e - no instruction

# 0x3f - no instruction

# 0x003a - no instruction

# eret
def(0x013a, TYPE_R,
  (ra, rb, rc) ->
    @st = @est
    return @gpr[EA]
  (ra, rb, rc) ->
    return D_N("eret")
)

# roli
def(0x023a, TYPE_R,
  (ra, rb, rc, opx) ->
    u5 = opx & 0x1f
    tmp = @gpr[ra]
    @gpr[rc] = (tmp << u5) | (tmp >>> (32 - u5))
    return
  (ra, rb, rc, opx) ->
    u5 = opx & 0x1f
    return D_RRD("roli", rc, ra, u5)
)

# rol
def(0x033a, TYPE_R,
  (ra, rb, rc) ->
    u5 = @gpr[rb] & 0x1f
    tmp = @gpr[ra]
    @gpr[rc] = (tmp << u5) | (tmp >>> (32 - u5))
    return
  (ra, rb, rc) ->
    return D_RRR("rol", rc, ra, rb)
)

# flashp
def(0x043a, TYPE_R,
  () ->
    throw 0 # TODO
  () ->
    return D_N("flashp")
)

# ret
def(0x053a, TYPE_R,
  () ->
    return @gpr[RA]
  () ->
    return D_N("ret")
)

# nor
def(0x063a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = ~(@gpr[ra] | @gpr[rb])
    return
  (ra, rb, rc) ->
    return D_RRR("nor", rc, ra, rb)
)

# mulxuu
def(0x073a, TYPE_R,
  (ra, rb, rc) ->
    throw "Unsupported" unless @cfg.mulx # TODO
    throw 0 # TODO
  (ra, rb, rc) ->
    return D_RRR("mulxuu", rc, ra, rb)
)

# cmpge
def(0x083a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = if @gpr[ra] >= @gpr[rb] then 1 else 0
    return
  (ra, rb, rc) ->
    return D_RRR("cmpge", rc, ra, rb)
)

# bret
def(0x093a, TYPE_R,
  () ->
    @st = @bst
    return @gpr[BA]
  () ->
    return D_N("bret")
)

# 0x0a3a - no instruction

# ror
def(0x0b3a, TYPE_R,
  (ra, rb, rc) ->
    u5  = @gpr[rb] & 0x1f
    tmp = @gpr[ra]
    @gpr[rc] = (tmp << (32 - u5)) | (tmp >>> u5)
    return
  (ra, rb, rc) ->
    return D_RRR("ror", rc, ra, rb)
)

# flashi
def(0x0c3a, TYPE_R,
  (ra) ->
    throw 0 # TODO
  (ra) ->
    return D_R("flashi", ra)
)

# jmp
def(0x0d3a, TYPE_R,
  (ra) ->
    return @gpr[ra]
  (ra) ->
    return D_R("jmp", ra)
)

# and
def(0x0e3a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = @gpr[ra] & @gpr[rb]
    return
  (ra, rb, rc) ->
    return D_RRR("and", rc, ra, rb)
)

# 0x0f3a - no instruction

# cmplt
def(0x103a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = if @gpr[ra] < @gpr[rb] then 1 else 0
    return
  (ra, rb, rc) ->
    return D_RRR("cmplt", rc, ra, rb)
)

# 0x113a - no instruction

# slli
def(0x123a, TYPE_R,
  (ra, rb, rc, opx) ->
    u5 = opx & 0x1f
    @gpr[rc] = @gpr[ra] << u5
    return
  (ra, rb, rc, opx) ->
    u5 = opx & 0x1f
    return D_RRD("slli", rc, ra, u5)
)

# sll
def(0x133a, TYPE_R,
  (ra, rb, rc) ->
    u5 = @gpr[rb] & 0x1f
    @gpr[rc] = @gpr[ra] << u5
    return
  (ra, rb, rc) ->
    return D_RRR("sll", rc, ra, rb)
)

# 0x153a - no instruction

# wrprs
def(0x143a, TYPE_R,
  (ra, rb, rc) ->
    throw 0 # TODO
  (ra, rb, rc) ->
    return D_RR("wrprs", rc, ra)
)

# or
def(0x163a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = @gpr[ra] | @gpr[rb]
    return
  (ra, rb, rc) ->
    return D_RRR("or", rc, ra, rb)
)

# mulxsu
def(0x173a, TYPE_R,
  (ra, rb, rc) ->
    throw "Unsupported" unless @cfg.mulx
    throw 0 # TODO
  (ra, rb, rc) ->
    return D_RRR("mulxsu", rc, ra, rb)
)

# cmpne
def(0x183a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = if @gpr[ra] != @gpr[rb] then 1 else 0
    return
  (ra, rb, rc) ->
    return D_RRR("cmpne", rc, ra, rb)
)

# 0x193a - no instruction

# srli
def(0x1a3a, TYPE_R,
  (ra, rb, rc, opx) ->
    @gpr[rc] = @gpr[ra] >>> (opx & 0x1f)
    return
  (ra, rb, rc, opx) ->
    return D_RRD("srli", rc, ra, opx & 0x1f)
)

# srl
def(0x1b3a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = @gpr[ra] >>> (@gpr[rb] & 0x1f)
    return
  (ra, rb, rc) ->
    return D_RRR("srl", rc, ra, rb)
)

# nextpc
def(0x1c3a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = @pc + 4
    return
  (ra, rb, rc) ->
    return D_R("nextpc", rc)
)

# callr
def(0x1d3a, TYPE_R,
  (ra) ->
    @gpr[RA] = @pc + 4
    return @gpr[ra]
  (ra) ->
    return D_R("callr", ra)
)

# xor
def(0x1e3a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = @gpr[ra] ^ @gpr[rb]
    return
  (ra, rb, rc) ->
    return D_RRR("xor", rc, ra, rb)
)

# mulxss
def(0x1f3a, TYPE_R,
  (ra, rb, rc) ->
    throw "Unsupported" unless @cfg.mulx # TODO
    throw 0 # TODO
  (ra, rb, rc) ->
    return D_RRR("mulxss", rc, ra, rb)
)

# cmpeq
def(0x203a, TYPE_R,
        # (R) cmpeq
  (ra, rb, rc) ->
    @gpr[rc] = if @gpr[ra] == @gpr[rb] then 1 else 0
    return
  (ra, rb, rc) ->
    return D_RRR("cmpeq", rc, ra, rb)
)

# 0x213a - no instruction

# 0x223a - no instruction

# 0x233a - no instruction

# divu
def(0x243a, TYPE_R,
  (ra, rb, rc) ->
    throw "Unsupported" unless @cfg.div # TODO
    throw 0 # TODO
  (ra, rb, rc) ->
    return D_RRR("divu", rc, ra, rb)
)

# div
def(0x253a, TYPE_R,
  (ra, rb, rc) ->
    throw "Unsupported" unless @cfg.div # TODO
    throw 0 # TODO
  (ra, rb, rc) ->
    return D_RRR("div", rc, ra, rb)
)

# rdctl
def(0x263a, TYPE_R,
  (ra, rb, rc, opx) ->
    n = (opx & 0x1f)
    throw 0 # TODO
  (ra, rb, rc, opx) ->
    n = (opx & 0x1f)
    return D_RC("rdctl", rc, n)
)

# mul
def(0x273a, TYPE_R,
  (ra, rb, rc) ->
    throw "Unsupported" unless @cfg.mul # TODO
    throw 0 # TODO
  (ra, rb, rc) ->
    return D_RRR("mul", rc, ra, rb)
)

# cmpgeu
def(0x283a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = if (@gpr[ra] >>> 0) >= (@gpr[rb] >>> 0) then 1 else 0
    return
  (ra, rb, rc) ->
    return D_RRR("cmpgeu", rc, ra, rb)
)

# initi
def(0x293a, TYPE_R,
  (ra) ->
    return
    throw 0 # TODO
  (ra) ->
    return D_R("initi", ra)
)

# 0x2a3a - no instruction

# 0x2b3a - no instruction

# 0x2c3a - no instruction

# trap
def(0x2d3a, TYPE_R,
  () ->
    @est = @st
    @st &= ~3 # PIE=0, U=0
    @gpr[EA] = @pc + 4
    return @cfg.evec
  (ra, rb, rc, opx) ->
    return D_D("trap", opx & 0x1f)
)

# wrctl
def(0x2e3a, TYPE_R,
  (ra, rb, rc, opx) ->
    n = (opx & 0x1f)
    throw 0 # TODO
  (ra, rb, rc, opx) ->
    n = (opx & 0x1f)
    return D_RC("wrctl", ra, n)
)

# 0x2f3a - no instruction

# cmpltu
def(0x303a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = if (@gpr[ra] >>> 0) < (@gpr[rb] >>> 0) then 1 else 0
    return
  (ra, rb, rc) ->
    return D_RRR("cmpgeu", rc, ra, rb)
)

# add
def(0x313a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = @gpr[ra] + @gpr[rb]
    return
  (ra, rb, rc) ->
    return D_RR("mov", rc, ra) if rb == ZR
    return D_RRR("add", rc, ra, rb)
)

# 0x323a - no instruction

# 0x333a - no instruction

# break
def(0x343a, TYPE_R,
  () ->
    throw 0 # TODO
  (ra, rb, rc, opx) ->
    return D_D("break", opx & 0x1f)
)

# 0x353a - no instruction

def(0x363a, TYPE_R,
  () ->
    throw 0 # TODO
  () ->
    return D_N("sync")
)

# 0x373a - no instruction

# 0x383a - no instruction

# sub
def(0x393a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = @gpr[ra] - @gpr[rb]
    return
  (ra, rb, rc) ->
    return D_RRR("add", rc, ra, rb)
)

# srai
def(0x3a3a, TYPE_R,
  (ra, rb, rc, opx) ->
    @gpr[rc] = @gpr[ra] >> (opx & 0x1f)
    return
  (ra, rb, rc, opx) ->
    return D_RRD("srai", rc, ra, opx & 0x1f)
)

# sra
def(0x3b3a, TYPE_R,
  (ra, rb, rc) ->
    @gpr[rc] = @gpr[ra] >> (@gpr[rb] & 0x1f)
    return
  (ra, rb, rc) ->
    return D_RRR("sra", rc, ra, rb)
)

# 0x3c3a - no instruction

# 0x3d3a - no instruction

# 0x3e3a - no instruction

# 0x3f3a - no instruction

module.exports = {exec, disas}

