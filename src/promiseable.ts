
export function then<T1, T2>(value: Promiseable<T1>, action: (value: T1) => T2): Promiseable<T2> {
    if (value == null) {
        return;
    }
    if (value instanceof Promise) {
        return value.then(action);
    }
    return action(value);
}

export type Promiseable<T> = T | Promise<T>;
