/**
 * Simplified Connection Manager
 * Follows the logic from OnyxConnectionManager but simplified for prototype purposes
 */

import type {OnyxKey, OnyxValue, Callback, CollectionCallback, Connection, ConnectOptions} from './types';

type ConnectCallback = Callback | CollectionCallback;

/**
 * Represents the connection's metadata
 */
interface ConnectionMetadata {
    /** The subscription ID returned by the subscription handler */
    subscriptionID: number;

    /** The Onyx key associated to this connection */
    onyxKey: OnyxKey;

    /** Whether the first connection's callback was fired */
    isConnectionMade: boolean;

    /** Map of subscriber callbacks for this connection */
    callbacks: Map<string, ConnectCallback>;

    /** The last callback value */
    cachedCallbackValue?: OnyxValue | null;

    /** The last callback key */
    cachedCallbackKey?: OnyxKey;

    /** Whether waiting for collection callback */
    waitForCollectionCallback?: boolean;
}

/**
 * Utility to generate a simple GUID
 */
function guid(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if a key is a collection key (ends with '_')
 */
function isCollectionKey(key: OnyxKey): boolean {
    return key.endsWith('_');
}

/**
 * Connection Manager class
 * Manages connections and subscriptions to Onyx keys
 */
class ConnectionManager {
    /** Map of connection IDs to their metadata */
    private connectionsMap: Map<string, ConnectionMetadata>;

    /** Counter for generating unique callback IDs */
    private lastCallbackID: number;

    /** Session ID to track connection lifecycle */
    private sessionID: string;

    /** External subscription handler (will be set by Onyx) */
    private subscriptionHandler?: (key: OnyxKey, callback: Callback) => number;

    /** External unsubscription handler (will be set by Onyx) */
    private unsubscriptionHandler?: (subscriptionID: number) => void;

    constructor() {
        this.connectionsMap = new Map();
        this.lastCallbackID = 0;
        this.sessionID = guid();
    }

    /**
     * Set the subscription handler (called by Onyx to wire up subscriptions)
     */
    setSubscriptionHandler(handler: (key: OnyxKey, callback: Callback) => number): void {
        this.subscriptionHandler = handler;
    }

    /**
     * Set the unsubscription handler (called by Onyx to wire up unsubscriptions)
     */
    setUnsubscriptionHandler(handler: (subscriptionID: number) => void): void {
        this.unsubscriptionHandler = handler;
    }

    /**
     * Generate a connection ID based on the connect options
     */
    private generateConnectionID<T>(connectOptions: ConnectOptions<T>): string {
        const {key, waitForCollectionCallback} = connectOptions;

        let suffix = `,sessionID=${this.sessionID}`;

        // Generate unique ID for collection keys without waitForCollectionCallback
        // This ensures each subscriber gets all collection entries
        if (isCollectionKey(key) && !waitForCollectionCallback) {
            suffix += `,uniqueID=${guid()}`;
        }

        return `onyxKey=${key},waitForCollectionCallback=${waitForCollectionCallback ?? false}${suffix}`;
    }

    /**
     * Fire all callbacks associated with a connection
     */
    private fireCallbacks(connectionID: string): void {
        const connection = this.connectionsMap.get(connectionID);
        if (!connection) {
            return;
        }

        connection.callbacks.forEach((callback) => {
            if (connection.waitForCollectionCallback) {
                (callback as CollectionCallback)(connection.cachedCallbackValue as Record<OnyxKey, OnyxValue>);
            } else {
                (callback as Callback)(connection.cachedCallbackValue, connection.cachedCallbackKey);
            }
        });
    }

    /**
     * Connect to an Onyx key
     */
    connect<T = OnyxValue>(connectOptions: ConnectOptions<T>): Connection {
        const connectionID = this.generateConnectionID(connectOptions);
        let connectionMetadata = this.connectionsMap.get(connectionID);

        const callbackID = String(this.lastCallbackID++);

        // Create new connection if it doesn't exist
        if (!connectionMetadata) {
            const internalCallback: Callback = (value, key) => {
                const conn = this.connectionsMap.get(connectionID);
                if (conn) {
                    // Mark connection as made and cache the value
                    conn.isConnectionMade = true;
                    conn.cachedCallbackValue = value;
                    conn.cachedCallbackKey = key;

                    // Fire all callbacks
                    this.fireCallbacks(connectionID);
                }
            };

            // Register with subscription handler and get subscription ID
            let subscriptionID = 0;
            if (this.subscriptionHandler) {
                subscriptionID = this.subscriptionHandler(connectOptions.key, internalCallback);
            }

            connectionMetadata = {
                subscriptionID,
                onyxKey: connectOptions.key,
                isConnectionMade: false,
                callbacks: new Map(),
                waitForCollectionCallback: connectOptions.waitForCollectionCallback,
            };

            this.connectionsMap.set(connectionID, connectionMetadata);
        }

        // Add subscriber's callback
        if (connectOptions.callback) {
            connectionMetadata.callbacks.set(callbackID, connectOptions.callback as ConnectCallback);
        }

        // If connection already made, fire callback immediately with cached value
        if (connectionMetadata.isConnectionMade) {
            Promise.resolve().then(() => {
                (connectOptions.callback as Callback)?.(connectionMetadata.cachedCallbackValue, connectionMetadata.cachedCallbackKey);
            });
        }

        return {id: connectionID, callbackID};
    }

    /**
     * Disconnect a subscriber
     */
    disconnect(connection: Connection): void {
        if (!connection) {
            return;
        }

        const connectionMetadata = this.connectionsMap.get(connection.id);
        if (!connectionMetadata) {
            return;
        }

        // Remove the callback
        connectionMetadata.callbacks.delete(connection.callbackID);

        // If no more callbacks, unsubscribe and remove the connection entirely
        if (connectionMetadata.callbacks.size === 0) {
            // Call unsubscription handler to clean up the subscription
            if (this.unsubscriptionHandler) {
                this.unsubscriptionHandler(connectionMetadata.subscriptionID);
            }

            this.connectionsMap.delete(connection.id);
        }
    }

    /**
     * Disconnect all connections
     */
    disconnectAll(): void {
        this.connectionsMap.clear();
    }

    /**
     * Refresh session ID (used when clearing Onyx)
     */
    refreshSessionID(): void {
        this.sessionID = guid();
    }

    /**
     * Get number of active connections
     */
    getConnectionCount(): number {
        return this.connectionsMap.size;
    }
}

const connectionManager = new ConnectionManager();
export default connectionManager;
