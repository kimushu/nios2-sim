import * as xml2js from "xml2js";

export class SopcInfo {
    static parse(xml) {
        return new Promise((resolve, reject) => {
            xml2js.parseString(xml, { mergeAttrs: true },
                (error, result) => {
                    if (error != null) {
                        return reject(error);
                    }
                    return resolve(result);
                }
            );
        })
        .then((data: any) => {
            let expand = (obj: any, dest: any = obj) => {
                for (let key in obj) {
                    let value = obj[key];
                    let sub: any;
                    switch (key) {
                        case "parameter":
                        case "module":
                        case "connection":
                        case "interface":
                            sub = {};
                            dest[key] = sub;
                            for (let item of value) {
                                expand(item);
                                let tag = item.name;
                                if (sub[tag] != null) {
                                    throw `found duplicated key (${tag}) in ${key}`;
                                }
                                sub[tag] = item;
                            }
                            break;
                        case "assignment":
                            sub = {};
                            dest[key] = sub;
                            for (let item of value) {
                                let path = item.name[0].split(".");
                                key = path.pop();
                                let cur = sub;
                                for (let dir in path) {
                                    if (cur[dir] == null) {
                                        cur[dir] = {};
                                    }
                                    //cur = (cur[dir] ?= {}) for dir in path
                                }
                                cur[key] = item.value[0];
                            }
                            break;
                        case "plugin":
                        case "memoryBlock":
                            dest[key] = value;
                            break;
                        default:
                            dest[key] = value[0];
                            break;
                    }
                }
            };
            let obj: any = {};
            expand((data != null ? data.EnsembleReport : undefined), obj);
            return obj;
        });
    }
}
