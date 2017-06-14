import { Module } from "./module";

class ClockSource extends Module {
    static kind = "clock_source";
}
Module.register(ClockSource);
