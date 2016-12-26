Promise = require("es6-promise")
{parseString} = require("xml2js")

class Qsys
  @load: (xml, options) ->
    modules = null
    return new Promise((resolve, reject) =>
      parseString(xml, (err, result) =>
        return reject(err) if err?
        root = result.EnsembleReport
        fabric = root?.$?.fabric
        return reject(
          Error("Unsupported fabric: #{fabric}")
        ) unless fabric == "QSYS"
        resolve(root)
      ) # parseString()
    ).then((root) =>
      return root.module.reduce(
        (promise, m) =>
          {path, kind} = m.$
          options.printInfo("Adding component: #{path} (#{kind})", 2)
          return promise
        Promise.resolve()
      ) # return root.module.reduce()
    ) # return new Promise().then()...

module.exports = {Qsys}
