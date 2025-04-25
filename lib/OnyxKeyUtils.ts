import * as Str from './Str';
import type {CollectionKeyBase, OnyxKey, CollectionKey} from './types';

/**
 * A set of collection key identifiers that is initialized by OnyxUtils
 * and made available for checking if a key is a collection key.
 */
let onyxCollectionKeySet = new Set<OnyxKey>();

/**
 * Updates the collection key set with the provided keys.
 * This is called by OnyxUtils during initialization.
 */
function setCollectionKeySet(keys: Set<OnyxKey>): void {
    onyxCollectionKeySet = keys;
}

/**
 * Returns the current collection key set.
 */
function getCollectionKeys(): Set<OnyxKey> {
    return onyxCollectionKeySet;
}

/**
 * Checks to see if the subscriber's supplied key
 * is associated with a collection of keys.
 */
function isCollectionKey(key: OnyxKey): key is CollectionKeyBase {
    return onyxCollectionKeySet.has(key);
}

/**
 * Checks to see if a provided key is the exact configured key of our connected subscriber
 * or if the provided key is a collection member key (in case our configured key is a "collection key")
 */
function isKeyMatch(configKey: OnyxKey, key: OnyxKey): boolean {
    return isCollectionKey(configKey) ? Str.startsWith(key, configKey) : configKey === key;
}

/**
 * Checks if a key is a member of a specific collection.
 */
function isCollectionMemberKey<TCollectionKey extends CollectionKeyBase>(collectionKey: TCollectionKey, key: string, collectionKeyLength: number): key is `${TCollectionKey}${string}` {
    return key.startsWith(collectionKey) && key.length > collectionKeyLength;
}

/**
 * Extracts the collection identifier of a given collection member key.
 *
 * For example:
 * - `getCollectionKey("report_123")` would return "report_"
 * - `getCollectionKey("report_")` would return "report_"
 * - `getCollectionKey("report_-1_something")` would return "report_"
 * - `getCollectionKey("sharedNVP_user_-1_something")` would return "sharedNVP_user_"
 *
 * @param key - The collection key to process.
 * @returns The plain collection key or throws an Error if the key is not a collection one.
 */
function getCollectionKey(key: CollectionKey): string {
    // Start by finding the position of the last underscore in the string
    let lastUnderscoreIndex = key.lastIndexOf('_');

    // Iterate backwards to find the longest key that ends with '_'
    while (lastUnderscoreIndex > 0) {
        const possibleKey = key.slice(0, lastUnderscoreIndex + 1);

        // Check if the substring is a key in the Set
        if (isCollectionKey(possibleKey)) {
            // Return the matching key and the rest of the string
            return possibleKey;
        }

        // Move to the next underscore to check smaller possible keys
        lastUnderscoreIndex = key.lastIndexOf('_', lastUnderscoreIndex - 1);
    }

    throw new Error(`Invalid '${key}' key provided, only collection keys are allowed.`);
}

/**
 * Splits a collection member key into the collection key part and the ID part.
 * @param key - The collection member key to split.
 * @param collectionKey - The collection key of the `key` param that can be passed in advance to optimize the function.
 * @returns A tuple where the first element is the collection part and the second element is the ID part,
 * or throws an Error if the key is not a collection one.
 */
function splitCollectionMemberKey<TKey extends CollectionKey, CollectionKeyType = TKey extends `${infer Prefix}_${string}` ? `${Prefix}_` : never>(
    key: TKey,
    collectionKey?: string,
): [CollectionKeyType, string] {
    if (collectionKey && !isCollectionMemberKey(collectionKey, key, collectionKey.length)) {
        throw new Error(`Invalid '${collectionKey}' collection key provided, it isn't compatible with '${key}' key.`);
    }

    if (!collectionKey) {
        // eslint-disable-next-line no-param-reassign
        collectionKey = getCollectionKey(key);
    }

    return [collectionKey as CollectionKeyType, key.slice(collectionKey.length)];
}

const OnyxKeyUtils = {
    setCollectionKeySet,
    getCollectionKeys,
    isCollectionKey,
    isKeyMatch,
    isCollectionMemberKey,
    getCollectionKey,
    splitCollectionMemberKey,
};

export default OnyxKeyUtils;
