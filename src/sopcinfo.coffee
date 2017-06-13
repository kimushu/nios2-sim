Promise = require("es6-promise")
xml2js = require("xml2js")

class exports.SopcInfo
  @parse: (xml) ->
    return new Promise((resolve, reject) =>
      xml2js.parseString(xml, {mergeAttrs: true},
        (error, result) =>
          return reject(error) if error?
          return resolve(result)
      )
    ).then((data) =>
      expand = (obj, dest) ->
        dest ?= obj
        for key, value of (obj or {})
          switch key
            when "parameter", "module", "connection", "interface"
              sub = {}
              dest[key] = sub
              for item in value
                expand(item)
                tag = item.name
                throw "found duplicated key (#{tag}) in #{key}" if sub[tag]?
                sub[tag] = item
            when "assignment"
              sub = {}
              dest[key] = sub
              for item in value
                path = item.name[0].split(".")
                key = path.pop()
                cur = sub
                cur = (cur[dir] ?= {}) for dir in path
                cur[key] = item.value[0]
            when "plugin", "memoryBlock"
              dest[key] = value
            else
              dest[key] = value[0]
      obj = {}
      expand(data?.EnsembleReport, obj)
      return obj
    ) # return new Promise().then()

