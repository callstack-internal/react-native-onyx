/**
 * Returns true if the haystack begins with the needle
 *
 * @param haystack  The full string to be searched
 * @param needle    The case-sensitive string to search for
 * @return Returns true if the haystack starts with the needle.
 */
function startsWith(haystack: string, needle: string) {
    return typeof haystack === 'string' && typeof needle === 'string' && haystack.startsWith(needle);
}

/**
 * Checks if parameter is a string or function.
 * If it is a string, then we will just return it.
 * If it is a function, then we will call it with
 * any additional arguments and return the result.
 */
function result(parameter: string): string;
function result<TFunction extends (...a: TArgs) => unknown, TArgs extends unknown[]>(parameter: TFunction, ...args: TArgs): ReturnType<TFunction>;
function result<TFunction extends (...a: TArgs) => unknown, TArgs extends unknown[]>(parameter: TFunction, ...args: TArgs): ReturnType<TFunction> | string {
    return typeof parameter === 'function' ? (parameter(...args) as ReturnType<TFunction>) : parameter;
}

/**
 * A simple GUID generator taken from https://stackoverflow.com/a/32760401/9114791
 */
function guid(): string {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
}

export {guid, result, startsWith};
