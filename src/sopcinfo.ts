import * as xml2js from "xml2js";

export interface SopcInfoRoot {
    name: string;
    kind: string;
    version: string;
    fabric: string;
    parameter: SopcInfoParameterSet;
    module: SopcInfoModuleSet;
    plugin: SopcInfoPlugin[];
    reportVersion: string;
    uniqueIdentifier: string;
}

export interface SopcInfoParameterSet {
    [name: string]: SopcInfoParameter;
}

export interface SopcInfoParameter {
    name: string;
    type: string;
    value: string;
    derived: "true" | "false";
    enabled: "true" | "false";
    visible: "true" | "false";
    valid: "true" | "false";
    sysinfo_type?: string;
    sysinfo_arg?: string;
}

export interface SopcInfoModuleSet {
    [name: string]: SopcInfoModule;
}

export interface SopcInfoModule {
    name: string;
    kind: string;
    version: string;
    path: string;
    assignment?: any;
    parameter?: SopcInfoParameterSet;
    interface?: SopcInfoInterfaceSet;
}

export interface SopcInfoInterfaceSet {
    [name: string]: SopcInfoInterface;
}

export interface SopcInfoInterface {
    name: string;
    kind: string;
    version: string;
    assignment?: any;
    parameter?: SopcInfoParameterSet;
    type: string;
    isStart: "true" | "false";
    port: any;
    memoryBlock?: SopcInfoMemoryBlock[];
}

export interface SopcInfoMemoryBlock {
    isBridge: "true" | "false";
    moduleName: string;
    slaveName: string;
    name: string;
    baseAddress: string;
    span: string;
}

export interface SopcInfoPlugin {
    instanceCount: string;
    name: string;
    type: string;
    subtype: string;
    displayName: string;
    version: string;
}

export class SopcInfo {
    static parse(xml: Buffer | string) {
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
                                let path: string[] = item.name[0].split(".");
                                key = path.pop();
                                let cur = sub;
                                for (let dir of path) {
                                    let sub = cur[dir];
                                    cur = (sub == null) ? (cur[dir] = {}) : sub;
                                }
                                cur[key] = item.value[0];
                            }
                            break;
                        case "plugin":
                        case "memoryBlock":
                            dest[key] = value.map((plugin) => {
                                let obj = {};
                                expand(plugin, obj);
                                return obj;
                            });
                            break;
                        default:
                            dest[key] = value[0];
                            break;
                    }
                }
            };
            let obj: SopcInfoRoot = <any>{};
            expand((data != null ? data.EnsembleReport : undefined), obj);
            return obj;
        });
    }
}
